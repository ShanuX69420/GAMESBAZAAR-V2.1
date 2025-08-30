import { PrismaClient } from '@prisma/client';
import { socketManager } from '../sockets/socketManager';

const prisma = new PrismaClient();

export class AutomatedDeliveryService {
  /**
   * Automatically deliver instant items when payment is confirmed
   */
  static async processAutomatedDelivery(orderId: string): Promise<boolean> {
    try {
      // Get order with listing details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          listing: true,
          buyer: true,
          seller: true
        }
      });

      if (!order) {
        console.error(`Order ${orderId} not found for automated delivery`);
        return false;
      }

      // Check if listing has instant delivery and delivery content
      if (order.listing.deliveryType !== 'instant' || !order.listing.deliveryContent) {
        console.log(`Order ${orderId} - Not eligible for automated delivery (deliveryType: ${order.listing.deliveryType}, hasContent: ${!!order.listing.deliveryContent})`);
        return false;
      }

      // Check if order is in PAID status
      if (order.status !== 'PAID') {
        console.log(`Order ${orderId} - Not in PAID status (current: ${order.status})`);
        return false;
      }

      // Create automated delivery message
      const deliveryMessage = await prisma.message.create({
        data: {
          orderId: order.id,
          senderId: order.sellerId, // Delivered by seller (system)
          receiverId: order.buyerId,
          content: order.listing.deliveryContent,
          type: 'delivery',
          isAutomatedDelivery: true
        }
      });

      // Update order status to DELIVERED
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED' }
      });

      // Create system message about automated delivery
      const systemMessage = await prisma.message.create({
        data: {
          orderId: order.id,
          senderId: order.sellerId,
          receiverId: order.buyerId,
          content: '🤖 Item has been automatically delivered. Please confirm receipt when you have received your item.',
          type: 'system',
          isAutomatedDelivery: false
        }
      });

      // Update stock if limited quantity
      if (order.listing.stockType === 'limited' && order.listing.quantity !== null) {
        const newQuantity = Math.max(0, order.listing.quantity - 1);
        await prisma.listing.update({
          where: { id: order.listing.id },
          data: { 
            quantity: newQuantity,
            active: newQuantity > 0 // Deactivate if out of stock
          }
        });
      }

      // Send real-time notifications via Socket.io
      const orderRoomId = `order:${order.id}`;
      
      // Notify both buyer and seller about the automated delivery
      socketManager.getIo().to(orderRoomId).emit('new-message', deliveryMessage);
      socketManager.getIo().to(orderRoomId).emit('new-message', systemMessage);
      socketManager.getIo().to(orderRoomId).emit('order-status-updated', {
        orderId: order.id,
        status: 'DELIVERED',
        automated: true
      });

      console.log(`✅ Automated delivery completed for order ${orderId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error in automated delivery for order ${orderId}:`, error);
      return false;
    }
  }

  /**
   * Check if a listing is eligible for automated delivery
   */
  static async isEligibleForAutomatedDelivery(listingId: string): Promise<boolean> {
    try {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId }
      });

      return !!(
        listing &&
        listing.deliveryType === 'instant' &&
        listing.deliveryContent &&
        listing.deliveryContent.trim().length > 0
      );
    } catch (error) {
      console.error(`Error checking automated delivery eligibility for listing ${listingId}:`, error);
      return false;
    }
  }

  /**
   * Validate delivery content before saving
   */
  static validateDeliveryContent(content: string | null | undefined): {
    isValid: boolean;
    error?: string;
  } {
    if (!content || content.trim().length === 0) {
      return {
        isValid: false,
        error: 'Delivery content is required for instant delivery items'
      };
    }

    if (content.length > 5000) {
      return {
        isValid: false,
        error: 'Delivery content cannot exceed 5000 characters'
      };
    }

    // Check for potential security issues (basic validation)
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onload=/i,
      /onerror=/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return {
          isValid: false,
          error: 'Delivery content contains invalid characters'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Get delivery statistics for admin dashboard
   */
  static async getDeliveryStats(): Promise<{
    totalAutomatedDeliveries: number;
    instantListings: number;
    manualListings: number;
    automationRate: number;
  }> {
    try {
      const [automatedDeliveries, instantListings, manualListings] = await Promise.all([
        prisma.message.count({
          where: { isAutomatedDelivery: true }
        }),
        prisma.listing.count({
          where: { 
            deliveryType: 'instant',
            deliveryContent: { not: null }
          }
        }),
        prisma.listing.count({
          where: { deliveryType: 'manual' }
        })
      ]);

      const totalListings = instantListings + manualListings;
      const automationRate = totalListings > 0 ? (instantListings / totalListings) * 100 : 0;

      return {
        totalAutomatedDeliveries: automatedDeliveries,
        instantListings,
        manualListings,
        automationRate: Math.round(automationRate * 100) / 100
      };
    } catch (error) {
      console.error('Error getting delivery statistics:', error);
      return {
        totalAutomatedDeliveries: 0,
        instantListings: 0,
        manualListings: 0,
        automationRate: 0
      };
    }
  }
}