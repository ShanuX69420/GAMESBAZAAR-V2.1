import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { JazzCashService } from '../services/jazzCashService'
import { EasypaisaService } from '../services/easypaisaService'

const prisma = new PrismaClient()
const jazzCashService = new JazzCashService()
const easypaisaService = new EasypaisaService()

export default async function paymentRoutes(fastify: FastifyInstance) {
  // Authentication middleware
  const authRequired = async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  // Initiate JazzCash payment
  fastify.post('/payments/jazzcash/initiate', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { orderId, paymentMethod } = request.body as { 
        orderId: string
        paymentMethod: 'jazzcash'
      }

      if (!orderId) {
        reply.status(400)
        return { error: 'Order ID is required' }
      }

      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { id: true, username: true, email: true } },
          seller: { select: { id: true, username: true } },
          listing: { select: { title: true, price: true } }
        }
      })

      if (!order) {
        reply.status(404)
        return { error: 'Order not found' }
      }

      // Verify user is the buyer
      if (order.buyerId !== userId) {
        reply.status(403)
        return { error: 'Only the buyer can initiate payment' }
      }

      if (order.status !== 'PENDING') {
        reply.status(400)
        return { error: 'Order is not in pending status' }
      }

      // Prepare transaction data
      const transactionData = {
        orderId: order.id,
        amount: order.amount.toNumber(),
        buyerEmail: order.buyer.email,
        description: `Payment for ${order.listing.title} - Order #${order.id.slice(-8)}`
      }

      // Initiate JazzCash transaction
      const result = await jazzCashService.initiateTransaction(transactionData)

      if (!result.success) {
        reply.status(400)
        return { error: result.error || 'Failed to initiate payment' }
      }

      // Update order with payment method and transaction ID
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentMethod: 'jazzcash',
          // Store transaction ID in a JSON field or add a new field
        }
      })

      return {
        success: true,
        transactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        message: 'JazzCash payment initiated successfully'
      }
    } catch (error) {
      console.error('JazzCash initiate error:', error)
      reply.status(500)
      return { error: 'Failed to initiate JazzCash payment' }
    }
  })

  // Initiate Easypaisa payment
  fastify.post('/payments/easypaisa/initiate', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { orderId, paymentMethod } = request.body as { 
        orderId: string
        paymentMethod: 'easypaisa'
      }

      if (!orderId) {
        reply.status(400)
        return { error: 'Order ID is required' }
      }

      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { id: true, username: true, email: true } },
          seller: { select: { id: true, username: true } },
          listing: { select: { title: true, price: true } }
        }
      })

      if (!order) {
        reply.status(404)
        return { error: 'Order not found' }
      }

      // Verify user is the buyer
      if (order.buyerId !== userId) {
        reply.status(403)
        return { error: 'Only the buyer can initiate payment' }
      }

      if (order.status !== 'PENDING') {
        reply.status(400)
        return { error: 'Order is not in pending status' }
      }

      // Prepare transaction data
      const transactionData = {
        orderId: order.id,
        amount: order.amount.toNumber(),
        buyerEmail: order.buyer.email,
        description: `Payment for ${order.listing.title} - Order #${order.id.slice(-8)}`
      }

      // Initiate Easypaisa transaction
      const result = await easypaisaService.initiateTransaction(transactionData)

      if (!result.success) {
        reply.status(400)
        return { error: result.error || 'Failed to initiate payment' }
      }

      // Update order with payment method
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentMethod: 'easypaisa'
        }
      })

      return {
        success: true,
        transactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        message: 'Easypaisa payment initiated successfully'
      }
    } catch (error) {
      console.error('Easypaisa initiate error:', error)
      reply.status(500)
      return { error: 'Failed to initiate Easypaisa payment' }
    }
  })

  // JazzCash callback/webhook handler
  fastify.post('/payments/jazzcash/callback', async (request, reply) => {
    try {
      const { 
        pp_TxnRefNo, 
        pp_ResponseCode, 
        pp_ResponseMessage,
        pp_BillReference,
        pp_SecureHash
      } = request.body as { 
        pp_TxnRefNo: string
        pp_ResponseCode: string
        pp_ResponseMessage: string
        pp_BillReference: string
        pp_SecureHash: string
      }

      console.log('JazzCash callback received:', {
        transactionId: pp_TxnRefNo,
        responseCode: pp_ResponseCode,
        orderId: pp_BillReference
      })

      // Verify transaction
      const isValid = await jazzCashService.verifyTransaction(pp_TxnRefNo, pp_SecureHash)
      
      if (!isValid) {
        reply.status(400)
        return { error: 'Invalid transaction verification' }
      }

      // Check if payment was successful (responseCode 000 means success in JazzCash)
      const isSuccessful = pp_ResponseCode === '000'

      if (isSuccessful) {
        // Update order status to PAID
        const order = await prisma.order.update({
          where: { id: pp_BillReference },
          data: { 
            status: 'PAID',
            paymentMethod: 'jazzcash'
          }
        })

        // Create system message
        await prisma.message.create({
          data: {
            orderId: pp_BillReference,
            senderId: order.buyerId,
            receiverId: order.sellerId,
            content: `💰 Payment completed via JazzCash! Transaction ID: ${pp_TxnRefNo}`,
            type: 'system',
            isAutomatedDelivery: false
          }
        })

        return { success: true, message: 'Payment verified and order updated' }
      } else {
        // Payment failed - keep order in PENDING status
        console.log('JazzCash payment failed:', pp_ResponseMessage)
        return { success: false, message: `Payment failed: ${pp_ResponseMessage}` }
      }
    } catch (error) {
      console.error('JazzCash callback error:', error)
      reply.status(500)
      return { error: 'Failed to process payment callback' }
    }
  })

  // Easypaisa callback/webhook handler
  fastify.post('/payments/easypaisa/callback', async (request, reply) => {
    try {
      const { 
        transactionId, 
        status,
        billReference,
        transactionAmount,
        hashValue
      } = request.body as { 
        transactionId: string
        status: string
        billReference: string
        transactionAmount: string
        hashValue: string
      }

      console.log('Easypaisa callback received:', {
        transactionId,
        status,
        orderId: billReference
      })

      // Verify transaction
      const isValid = await easypaisaService.verifyTransaction(transactionId, hashValue)
      
      if (!isValid) {
        reply.status(400)
        return { error: 'Invalid transaction verification' }
      }

      // Check if payment was successful
      const isSuccessful = status === 'PAID' || status === 'SUCCESS'

      if (isSuccessful) {
        // Update order status to PAID
        const order = await prisma.order.update({
          where: { id: billReference },
          data: { 
            status: 'PAID',
            paymentMethod: 'easypaisa'
          }
        })

        // Create system message
        await prisma.message.create({
          data: {
            orderId: billReference,
            senderId: order.buyerId,
            receiverId: order.sellerId,
            content: `💰 Payment completed via Easypaisa! Transaction ID: ${transactionId}`,
            type: 'system',
            isAutomatedDelivery: false
          }
        })

        return { success: true, message: 'Payment verified and order updated' }
      } else {
        // Payment failed - keep order in PENDING status
        console.log('Easypaisa payment failed:', status)
        return { success: false, message: `Payment failed: ${status}` }
      }
    } catch (error) {
      console.error('Easypaisa callback error:', error)
      reply.status(500)
      return { error: 'Failed to process payment callback' }
    }
  })

  // Get payment methods available for an order
  fastify.get('/payments/methods/:orderId', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { orderId } = request.params as { orderId: string }

      // Verify order exists and user is the buyer
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { 
          id: true, 
          buyerId: true, 
          amount: true, 
          status: true 
        }
      })

      if (!order) {
        reply.status(404)
        return { error: 'Order not found' }
      }

      if (order.buyerId !== userId) {
        reply.status(403)
        return { error: 'Access denied' }
      }

      if (order.status !== 'PENDING') {
        reply.status(400)
        return { error: 'Order is not pending payment' }
      }

      const amount = order.amount.toNumber()

      return {
        availableMethods: [
          {
            id: 'jazzcash',
            name: 'JazzCash',
            description: 'Pay using JazzCash mobile wallet',
            minAmount: 10,
            maxAmount: 1000000,
            processingFee: 0,
            available: amount >= 10 && amount <= 1000000,
            icon: '📱'
          },
          {
            id: 'easypaisa',
            name: 'Easypaisa',
            description: 'Pay using Easypaisa mobile wallet',
            minAmount: 10,
            maxAmount: 500000,
            processingFee: 0,
            available: amount >= 10 && amount <= 500000,
            icon: '💳'
          },
          {
            id: 'bank_transfer',
            name: 'Bank Transfer',
            description: 'Direct bank transfer (manual verification)',
            minAmount: 100,
            maxAmount: 10000000,
            processingFee: 0,
            available: amount >= 100,
            icon: '🏦'
          }
        ],
        orderAmount: amount,
        currency: 'PKR'
      }
    } catch (error) {
      console.error('Payment methods error:', error)
      reply.status(500)
      return { error: 'Failed to fetch payment methods' }
    }
  })

  // Generate payment form HTML (for direct form submission)
  fastify.get('/payments/:method/:orderId/form', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { method, orderId } = request.params as { method: string, orderId: string }

      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { email: true } },
          listing: { select: { title: true } }
        }
      })

      if (!order || order.buyerId !== userId) {
        reply.status(404)
        return { error: 'Order not found or access denied' }
      }

      const transactionData = {
        orderId: order.id,
        amount: order.amount.toNumber(),
        buyerEmail: order.buyer.email,
        description: `Payment for ${order.listing.title}`
      }

      let formHTML = ''

      switch (method) {
        case 'jazzcash':
          formHTML = jazzCashService.generatePaymentForm(transactionData)
          break
        case 'easypaisa':
          formHTML = easypaisaService.generatePaymentForm(transactionData)
          break
        default:
          reply.status(400)
          return { error: 'Unsupported payment method' }
      }

      reply.type('text/html')
      return formHTML
    } catch (error) {
      console.error('Payment form error:', error)
      reply.status(500)
      return { error: 'Failed to generate payment form' }
    }
  })
}