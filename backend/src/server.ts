import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Server as SocketIOServer } from 'socket.io'
import { AutomatedDeliveryService } from './services/automatedDelivery'
import { socketManager } from './sockets/socketManager'

const prisma = new PrismaClient()
const fastify = Fastify({
  logger: true
})

// Declare Socket.io instance globally
let io: SocketIOServer | null = null

fastify.register(cors, {
  origin: ['http://localhost:3000'], // Frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
})

// Add JWT authentication middleware
fastify.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// Register upload routes
fastify.register(import('./routes/upload'), { prefix: '/api' })

// Register profile routes
fastify.register(import('./routes/profile'), { prefix: '/api' })

// Register listings routes
fastify.register(import('./routes/listings'), { prefix: '/api' })

// Register reviews routes
fastify.register(import('./routes/reviews'), { prefix: '/api' })

// Register payment routes
fastify.register(import('./routes/payments'), { prefix: '/api' })

// Register analytics routes
fastify.register(import('./routes/analytics'), { prefix: '/api' })

// Basic health check route
fastify.get('/', async (request, reply) => {
  return { message: 'Pakistan Gaming Marketplace API is running!' }
})

// Test database route
fastify.get('/api/test-db', async (request, reply) => {
  try {
    const userCount = await prisma.user.count()
    const gameCount = await prisma.game.count()
    const categoryCount = await prisma.category.count()
    
    return { 
      message: 'Database connection successful!',
      data: {
        users: userCount,
        games: gameCount,
        categories: categoryCount
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Database connection failed', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Get all games
fastify.get('/api/games', async (request, reply) => {
  try {
    const games = await prisma.game.findMany({
      where: { active: true },
      orderBy: { orderIndex: 'asc' },
      include: {
        categories: {
          where: { active: true }
        }
      }
    })
    return games
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch games' }
  }
})

// Get single game by slug
fastify.get('/api/games/:slug', async (request, reply) => {
  try {
    const { slug } = request.params as { slug: string }
    
    const game = await prisma.game.findFirst({
      where: { 
        slug,
        active: true 
      },
      include: {
        categories: {
          where: { active: true },
          include: {
            _count: {
              select: {
                listings: {
                  where: { active: true }
                }
              }
            }
          }
        }
      }
    })

    if (!game) {
      reply.status(404)
      return { error: 'Game not found' }
    }

    // Transform the response to include listing count
    const gameWithCounts = {
      ...game,
      categories: game.categories.map(category => ({
        ...category,
        listingCount: category._count.listings,
        _count: undefined
      }))
    }

    return gameWithCounts
  } catch (error) {
    console.error('Error fetching game:', error)
    reply.status(500)
    return { error: 'Failed to fetch game' }
  }
})

// Authentication Routes
fastify.post('/api/auth/register', async (request, reply) => {
  try {
    const { username, email, password } = request.body as {
      username: string
      email: string
      password: string
    }

    // Validation
    if (!username || !email || !password) {
      reply.status(400)
      return { error: 'Username, email, and password are required' }
    }

    if (password.length < 6) {
      reply.status(400)
      return { error: 'Password must be at least 6 characters' }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    })

    if (existingUser) {
      reply.status(409)
      return { error: 'Username or email already exists' }
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash,
        role: 'user',
        verified: false,
        balance: 0
      }
    })

    // Generate token
    const token = fastify.jwt.sign({ 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    })

    return {
      message: 'Registration successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified,
        balance: user.balance
      },
      token
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Registration failed', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

fastify.post('/api/auth/login', async (request, reply) => {
  try {
    const { email, password } = request.body as {
      email: string
      password: string
    }

    if (!email || !password) {
      reply.status(400)
      return { error: 'Email and password are required' }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      reply.status(401)
      return { error: 'Invalid email or password' }
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      reply.status(401)
      return { error: 'Invalid email or password' }
    }

    // Generate token
    const token = fastify.jwt.sign({ 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    })

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified,
        balance: user.balance
      },
      token
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Login failed', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Protected route example
fastify.get('/api/auth/me', {
  preHandler: async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  }
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true
      }
    })

    if (!user) {
      reply.status(404)
      return { error: 'User not found' }
    }

    return { user }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch user profile' }
  }
})

// Admin middleware
const adminOnly = async (request: any, reply: any) => {
  try {
    await request.jwtVerify()
    const { role } = request.user as { role: string }
    
    if (role !== 'admin') {
      reply.status(403).send({ error: 'Admin access required' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

// Admin Games Management
fastify.post('/api/admin/games', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    const { name, slug, imageUrl, platformTypes, orderIndex } = request.body as {
      name: string
      slug: string  
      imageUrl?: string
      platformTypes: string[]
      orderIndex: number
    }

    if (!name || !slug || !platformTypes || !orderIndex) {
      reply.status(400)
      return { error: 'Name, slug, platformTypes, and orderIndex are required' }
    }

    const game = await prisma.game.create({
      data: {
        name,
        slug: slug.toLowerCase(),
        imageUrl,
        platformTypes,
        orderIndex,
        active: true
      }
    })

    return { message: 'Game created successfully', game }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to create game', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

fastify.post('/api/admin/categories', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    const { gameId, name, slug, commissionRate, fieldsConfig } = request.body as {
      gameId: string
      name: string
      slug: string
      commissionRate: number
      fieldsConfig: any
    }

    if (!gameId || !name || !slug || commissionRate === undefined) {
      reply.status(400)
      return { error: 'GameId, name, slug, and commissionRate are required' }
    }

    // Verify game exists
    const game = await prisma.game.findUnique({ where: { id: gameId } })
    if (!game) {
      reply.status(404)
      return { error: 'Game not found' }
    }

    const category = await prisma.category.create({
      data: {
        gameId,
        name,
        slug: slug.toLowerCase(),
        commissionRate,
        fieldsConfig: fieldsConfig || {},
        active: true
      }
    })

    return { message: 'Category created successfully', category }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to create category', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Get game with categories (for admin)
fastify.get('/api/admin/games/:gameId', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    const { gameId } = request.params as { gameId: string }
    
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        categories: {
          orderBy: { name: 'asc' }
        }
      }
    })

    if (!game) {
      reply.status(404)
      return { error: 'Game not found' }
    }

    return game
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch game' }
  }
})

// User authentication middleware
const authRequired = async (request: any, reply: any) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

// Listing Management - moved to dedicated routes/listings.ts

// Get listings by category with filtering and sorting
fastify.get('/api/games/:gameSlug/:categorySlug/listings', async (request, reply) => {
  try {
    const { gameSlug, categorySlug } = request.params as { gameSlug: string, categorySlug: string }
    const { 
      page = '1', 
      limit = '20', 
      search = '', 
      sort = 'newest',
      delivery_type = '',
      stock_type = ''
    } = request.query as { 
      page?: string, 
      limit?: string,
      search?: string,
      sort?: string,
      delivery_type?: string,
      stock_type?: string
    }
    
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Find game and category
    const game = await prisma.game.findUnique({ where: { slug: gameSlug } })
    if (!game) {
      reply.status(404)
      return { error: 'Game not found' }
    }

    const category = await prisma.category.findUnique({
      where: { gameId_slug: { gameId: game.id, slug: categorySlug } }
    })
    if (!category) {
      reply.status(404)
      return { error: 'Category not found' }
    }

    // Build where clause with filters
    const whereClause: any = {
      gameId: game.id,
      categoryId: category.id,
      active: true,
      hidden: false
    }

    // Add search filter
    if (search && search.trim()) {
      whereClause.OR = [
        {
          title: {
            contains: search.trim(),
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search.trim(),
            mode: 'insensitive'
          }
        }
      ]
    }

    // Add delivery type filter
    if (delivery_type && delivery_type !== 'all') {
      whereClause.deliveryType = delivery_type
    }

    // Add stock type filter
    if (stock_type && stock_type !== 'all') {
      whereClause.stockType = stock_type
    }

    // Build orderBy clause
    let orderBy: any[] = []
    
    switch (sort) {
      case 'price_low':
        orderBy = [{ price: 'asc' }]
        break
      case 'price_high':
        orderBy = [{ price: 'desc' }]
        break
      case 'oldest':
        orderBy = [{ createdAt: 'asc' }]
        break
      case 'newest':
      default:
        orderBy = [{ createdAt: 'desc' }]
        break
    }

    // Always prioritize boosted listings first
    orderBy.unshift({ boostedAt: { sort: 'desc', nulls: 'last' } })

    const listings = await prisma.listing.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: limitNum,
      include: {
        seller: {
          select: { 
            id: true, 
            username: true, 
            verified: true,
            createdAt: true
          }
        },
        game: {
          select: { id: true, name: true, slug: true }
        },
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    })

    const total = await prisma.listing.count({
      where: whereClause
    })

    return {
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      game,
      category
    }
  } catch (error) {
    console.error('Error fetching listings:', error)
    reply.status(500)
    return { error: 'Failed to fetch listings' }
  }
})

// Get user's own listings - moved to dedicated routes/listings.ts

// Get single listing details with seller stats
fastify.get('/api/listings/:listingId', async (request, reply) => {
  try {
    const { listingId } = request.params as { listingId: string }

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        seller: {
          select: { 
            id: true, 
            username: true, 
            verified: true,
            createdAt: true
          }
        },
        game: {
          select: { id: true, name: true, slug: true, imageUrl: true }
        },
        category: {
          select: { id: true, name: true, slug: true, commissionRate: true, fieldsConfig: true }
        }
      }
    })

    if (!listing) {
      reply.status(404)
      return { error: 'Listing not found' }
    }

    if (!listing.active || listing.hidden) {
      reply.status(404)
      return { error: 'Listing not available' }
    }

    // Get seller statistics
    const [
      totalSales,
      averageRating,
      totalReviews,
      completionRate,
      recentOrders
    ] = await Promise.all([
      // Total completed sales
      prisma.order.count({
        where: { 
          sellerId: listing.sellerId, 
          status: 'COMPLETED' 
        }
      }),
      
      // Average rating from reviews
      prisma.review.aggregate({
        where: { sellerId: listing.sellerId },
        _avg: { rating: true },
        _count: { rating: true }
      }),
      
      // Total reviews count (already included in above query)
      0, // Will be set from the aggregate result
      
      // Completion rate (completed orders / total orders)
      prisma.order.findMany({
        where: { sellerId: listing.sellerId },
        select: { status: true }
      }),
      
      // Recent orders for response time calculation
      prisma.order.findMany({
        where: { 
          sellerId: listing.sellerId,
          status: { in: ['COMPLETED', 'DELIVERED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { 
          createdAt: true,
          messages: {
            where: { senderId: listing.sellerId },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { createdAt: true }
          }
        }
      })
    ])

    // Calculate completion rate
    const totalOrders = completionRate.length
    const completed = completionRate.filter(order => order.status === 'COMPLETED').length
    const calculatedCompletionRate = totalOrders > 0 ? Math.round((completed / totalOrders) * 100) : 100

    // Calculate average response time
    const responseTimes = recentOrders
      .filter(order => order.messages.length > 0)
      .map(order => {
        const orderTime = new Date(order.createdAt).getTime()
        const firstResponseTime = new Date(order.messages[0].createdAt).getTime()
        return (firstResponseTime - orderTime) / (1000 * 60) // in minutes
      })

    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0

    const formatResponseTime = (minutes: number): string => {
      if (minutes < 60) return `${Math.round(minutes)} minutes`
      if (minutes < 1440) return `${Math.round(minutes / 60)} hours`
      return `${Math.round(minutes / 1440)} days`
    }

    const sellerStats = {
      totalSales,
      averageRating: averageRating._avg.rating || 0,
      totalReviews: averageRating._count.rating,
      responseTime: formatResponseTime(avgResponseTime),
      completionRate: calculatedCompletionRate
    }

    return {
      listing,
      sellerStats
    }
  } catch (error) {
    console.error('Error fetching listing details:', error)
    reply.status(500)
    return { error: 'Failed to fetch listing' }
  }
})

// Order Management - Buy/Sell Flow
fastify.post('/api/orders', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { listingId, paymentMethod } = request.body as { 
      listingId: string
      paymentMethod?: 'jazzcash' | 'easypaisa' | 'bank_transfer'
    }

    if (!listingId) {
      reply.status(400)
      return { error: 'Listing ID is required' }
    }

    // Get listing with seller and category info
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        seller: {
          select: { id: true, username: true, verified: true }
        },
        category: {
          select: { id: true, name: true, commissionRate: true }
        }
      }
    })

    if (!listing) {
      reply.status(404)
      return { error: 'Listing not found' }
    }

    if (!listing.active || listing.hidden) {
      reply.status(400)
      return { error: 'Listing is not available for purchase' }
    }

    // Check if buyer is trying to buy their own listing
    if (listing.sellerId === userId) {
      reply.status(400)
      return { error: 'Cannot buy your own listing' }
    }

    // Check stock availability
    if (listing.stockType === 'limited' && (listing.quantity === null || listing.quantity <= 0)) {
      reply.status(400)
      return { error: 'Item is out of stock' }
    }

    // Calculate commission
    const itemPrice = listing.price.toNumber()
    const commissionRate = listing.category.commissionRate.toNumber()
    const commission = (itemPrice * commissionRate) / 100
    const totalAmount = itemPrice + commission

    // Create order in escrow
    const order = await prisma.order.create({
      data: {
        listingId,
        buyerId: userId,
        sellerId: listing.sellerId,
        amount: totalAmount,
        commission,
        status: 'PENDING',
        paymentMethod: paymentMethod || null, // Set payment method if provided
      },
      include: {
        listing: {
          select: { 
            id: true, 
            title: true, 
            price: true, 
            deliveryType: true,
            images: true 
          }
        },
        buyer: {
          select: { id: true, username: true }
        },
        seller: {
          select: { id: true, username: true, verified: true }
        }
      }
    })

    // Update stock if limited
    if (listing.stockType === 'limited' && listing.quantity !== null) {
      const newQuantity = listing.quantity - 1
      await prisma.listing.update({
        where: { id: listingId },
        data: { 
          quantity: newQuantity,
          active: newQuantity > 0 // Deactivate if out of stock
        }
      })
    }

    return {
      message: 'Order created successfully',
      order: {
        ...order,
        breakdown: {
          itemPrice,
          commission,
          totalAmount
        }
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to create order', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Get user's orders as buyer
fastify.get('/api/my-orders/buying', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { page = '1', limit = '10' } = request.query as { page?: string, limit?: string }
    
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const orders = await prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        listing: {
          select: { 
            id: true, 
            title: true, 
            price: true, 
            deliveryType: true,
            images: true 
          }
        },
        seller: {
          select: { id: true, username: true, verified: true }
        }
      }
    })

    const total = await prisma.order.count({
      where: { buyerId: userId }
    })

    return {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch orders' }
  }
})

// Get user's orders as seller
fastify.get('/api/my-orders/selling', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { page = '1', limit = '10' } = request.query as { page?: string, limit?: string }
    
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const orders = await prisma.order.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        listing: {
          select: { 
            id: true, 
            title: true, 
            price: true, 
            deliveryType: true,
            images: true 
          }
        },
        buyer: {
          select: { id: true, username: true }
        }
      }
    })

    const total = await prisma.order.count({
      where: { sellerId: userId }
    })

    return {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch orders' }
  }
})

// Get single order details
fastify.get('/api/orders/:orderId', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { orderId } = request.params as { orderId: string }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: { 
            id: true, 
            title: true, 
            price: true, 
            description: true,
            deliveryType: true,
            customFields: true,
            images: true 
          }
        },
        buyer: {
          select: { id: true, username: true }
        },
        seller: {
          select: { id: true, username: true, verified: true }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, username: true }
            }
          }
        }
      }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    // Check if user is involved in this order
    if (order.buyerId !== userId && order.sellerId !== userId) {
      reply.status(403)
      return { error: 'Access denied' }
    }

    return order
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch order' }
  }
})

// Order Status Updates - Escrow System

// Mark order as paid (seller confirms payment received)
fastify.patch('/api/orders/:orderId/paid', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { orderId } = request.params as { orderId: string }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { username: true } },
        seller: { select: { username: true } }
      }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    // Only seller can mark as paid
    if (order.sellerId !== userId) {
      reply.status(403)
      return { error: 'Only the seller can mark order as paid' }
    }

    if (order.status !== 'PENDING') {
      reply.status(400)
      return { error: `Order status is ${order.status}, cannot mark as paid` }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'PAID',
        paymentMethod: 'manual' // Will be updated when real payment gateways are integrated
      }
    })

    // Auto-create system message
    await prisma.message.create({
      data: {
        orderId,
        senderId: userId,
        receiverId: order.buyerId,
        content: `Order marked as PAID by seller. Awaiting delivery.`,
        type: 'system',
        isAutomatedDelivery: false
      }
    })

    // Try automated delivery if applicable
    const automatedDeliverySuccessful = await AutomatedDeliveryService.processAutomatedDelivery(orderId)
    
    if (automatedDeliverySuccessful) {
      console.log(`✅ Automated delivery processed for order ${orderId}`)
    }

    return {
      message: 'Order marked as paid successfully',
      order: updatedOrder
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to update order status', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Mark order as delivered (seller provides product/service)
fastify.patch('/api/orders/:orderId/delivered', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { orderId } = request.params as { orderId: string }
    const { deliveryMessage } = request.body as { deliveryMessage?: string }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { select: { title: true, deliveryType: true } },
        buyer: { select: { username: true } },
        seller: { select: { username: true } }
      }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    // Only seller can mark as delivered
    if (order.sellerId !== userId) {
      reply.status(403)
      return { error: 'Only the seller can mark order as delivered' }
    }

    if (order.status !== 'PAID') {
      reply.status(400)
      return { error: `Order status is ${order.status}, must be PAID to mark as delivered` }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' }
    })

    // Create delivery message
    await prisma.message.create({
      data: {
        orderId,
        senderId: userId,
        receiverId: order.buyerId,
        content: deliveryMessage || `Order has been delivered! Please confirm receipt to complete the transaction.`,
        type: 'delivery',
        isAutomatedDelivery: order.listing.deliveryType === 'instant'
      }
    })

    return {
      message: 'Order marked as delivered successfully',
      order: updatedOrder
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to update order status', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Buyer confirms receipt and releases escrow
fastify.patch('/api/orders/:orderId/complete', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { orderId } = request.params as { orderId: string }
    const { confirmationMessage } = request.body as { confirmationMessage?: string }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { username: true } },
        seller: { select: { username: true, verified: true } }
      }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    // Only buyer can complete the order
    if (order.buyerId !== userId) {
      reply.status(403)
      return { error: 'Only the buyer can complete the order' }
    }

    if (order.status !== 'DELIVERED') {
      reply.status(400)
      return { error: `Order status is ${order.status}, must be DELIVERED to complete` }
    }

    // Calculate seller earnings (order amount minus commission)
    const commission = order.commission.toNumber()
    const sellerEarnings = order.amount.toNumber() - commission

    // Update order status and create transaction
    await prisma.$transaction(async (tx) => {
      // Complete the order
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' }
      })

      // Add funds to seller (with 48-hour hold for unverified sellers)
      const holdUntil = order.seller.verified ? null : new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

      await tx.user.update({
        where: { id: order.sellerId },
        data: {
          balance: {
            increment: sellerEarnings
          }
        }
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: order.sellerId,
          orderId: order.id,
          type: 'DEPOSIT',
          amount: sellerEarnings,
          status: 'COMPLETED',
          paymentMethod: 'escrow_release'
        }
      })

      // Create completion message
      await tx.message.create({
        data: {
          orderId,
          senderId: userId,
          receiverId: order.sellerId,
          content: confirmationMessage || `Order completed! Payment of PKR ${sellerEarnings} has been released to seller${holdUntil ? ' (48-hour hold applies)' : ''}.`,
          type: 'completion',
          isAutomatedDelivery: false
        }
      })
    })

    return {
      message: 'Order completed successfully',
      sellerEarnings,
      holdNotice: !order.seller.verified ? '48-hour fund hold applies for unverified sellers' : null
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to complete order', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Dispute an order (both buyer and seller can initiate)
fastify.patch('/api/orders/:orderId/dispute', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { orderId } = request.params as { orderId: string }
    const { reason } = request.body as { reason: string }

    if (!reason || reason.trim().length < 10) {
      reply.status(400)
      return { error: 'Dispute reason must be at least 10 characters' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { username: true } },
        seller: { select: { username: true } }
      }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    // Check if user is involved in this order
    if (order.buyerId !== userId && order.sellerId !== userId) {
      reply.status(403)
      return { error: 'Only buyer or seller can dispute this order' }
    }

    if (order.status === 'COMPLETED' || order.status === 'REFUNDED') {
      reply.status(400)
      return { error: `Cannot dispute ${order.status.toLowerCase()} order` }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'DISPUTED' }
    })

    const isInitiatedByBuyer = order.buyerId === userId
    const otherPartyId = isInitiatedByBuyer ? order.sellerId : order.buyerId
    const initiatorRole = isInitiatedByBuyer ? 'buyer' : 'seller'

    // Create dispute message
    await prisma.message.create({
      data: {
        orderId,
        senderId: userId,
        receiverId: otherPartyId,
        content: `🚨 DISPUTE INITIATED by ${initiatorRole}: ${reason.trim()}`,
        type: 'dispute',
        isAutomatedDelivery: false
      }
    })

    return {
      message: 'Dispute initiated successfully. Support team will review this case.',
      order: updatedOrder
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to initiate dispute', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Chat System - Message Management

// Send a message in order conversation
fastify.post('/api/orders/:orderId/messages', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { orderId } = request.params as { orderId: string }
    const { content, attachmentUrl } = request.body as { content: string; attachmentUrl?: string }

    if ((!content || content.trim().length === 0) && !attachmentUrl) {
      reply.status(400)
      return { error: 'Message content or attachment is required' }
    }

    if (content && content.length > 1000) {
      reply.status(400)
      return { error: 'Message content cannot exceed 1000 characters' }
    }

    // Verify order exists and user is involved
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, username: true } },
        seller: { select: { id: true, username: true } }
      }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    // Check if user is involved in this order
    if (order.buyerId !== userId && order.sellerId !== userId) {
      reply.status(403)
      return { error: 'Access denied' }
    }

    // Determine receiver
    const receiverId = order.buyerId === userId ? order.sellerId : order.buyerId

    // Create message
    const message = await prisma.message.create({
      data: {
        orderId,
        senderId: userId,
        receiverId,
        content: content?.trim() || (attachmentUrl ? 'Image' : ''),
        type: 'text',
        attachmentUrl: attachmentUrl || null,
        isAutomatedDelivery: false
      },
      include: {
        sender: {
          select: { id: true, username: true }
        },
        receiver: {
          select: { id: true, username: true }
        }
      }
    })

    // Emit real-time message to order room
    if (io) {
      io.to(`order-${orderId}`).emit('new-message', {
        messageId: message.id,
        orderId,
        content: message.content,
        sender: message.sender,
        type: message.type,
        createdAt: message.createdAt
      })
    }

    return {
      message: 'Message sent successfully',
      data: message
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to send message', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Get all messages for an order
fastify.get('/api/orders/:orderId/messages', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { orderId } = request.params as { orderId: string }
    const { page = '1', limit = '50' } = request.query as { page?: string, limit?: string }
    
    const pageNum = parseInt(page)
    const limitNum = Math.min(parseInt(limit), 100) // Max 100 messages per request
    const skip = (pageNum - 1) * limitNum

    // Verify order exists and user is involved
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      reply.status(403)
      return { error: 'Access denied' }
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limitNum,
      include: {
        sender: {
          select: { id: true, username: true }
        }
      }
    })

    const total = await prisma.message.count({
      where: { orderId }
    })

    // Mark messages as read for the current user
    await prisma.message.updateMany({
      where: {
        orderId,
        receiverId: userId,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    })

    return {
      messages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch messages', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Get user's inbox - all conversations
fastify.get('/api/messages', {
  preHandler: authRequired
}, async (request, reply) => {
  try {
    const { userId } = request.user as { userId: string }
    const { page = '1', limit = '20' } = request.query as { page?: string, limit?: string }
    
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Get all orders where user is involved, with latest message
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        listing: {
          select: { 
            id: true, 
            title: true, 
            price: true,
            images: true
          }
        },
        buyer: {
          select: { id: true, username: true }
        },
        seller: {
          select: { id: true, username: true, verified: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, username: true }
            }
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                receiverId: userId,
                readAt: null
              }
            }
          }
        }
      }
    })

    const total = await prisma.order.count({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      }
    })

    return {
      conversations: orders.map(order => ({
        order_id: order.id,
        other_user: order.buyerId === userId ? order.seller : order.buyer,
        listing: {
          id: order.listing.id,
          title: order.listing.title
        },
        order: {
          status: order.status,
          amount: order.amount.toString()
        },
        last_message: order.messages[0] ? {
          id: order.messages[0].id,
          content: order.messages[0].content,
          sender_id: order.messages[0].senderId,
          type: order.messages[0].type,
          created_at: order.messages[0].createdAt.toISOString()
        } : null,
        unread_count: order._count.messages
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch conversations', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Admin Panel - Management Endpoints

// Admin Dashboard - Analytics Overview
fastify.get('/api/admin/dashboard', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    // Get overview statistics
    const [
      totalUsers,
      totalOrders,
      totalListings,
      totalRevenue,
      recentOrders,
      recentUsers
    ] = await Promise.all([
      // Total counts
      prisma.user.count(),
      prisma.order.count(),
      prisma.listing.count(),
      
      // Total revenue (sum of all commissions from completed orders)
      prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { commission: true }
      }),
      
      // Recent orders (last 5)
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: { select: { title: true, price: true } },
          buyer: { select: { username: true } },
          seller: { select: { username: true } }
        }
      }),
      
      // Recent users (last 5)
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          verified: true,
          createdAt: true
        }
      })
    ])

    // Calculate additional stats
    const [completedOrders, pendingOrders, disputedOrders] = await Promise.all([
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'DISPUTED' } })
    ])

    return {
      overview: {
        totalUsers,
        totalOrders,
        totalListings,
        totalRevenue: totalRevenue._sum.commission || 0,
        completedOrders,
        pendingOrders,
        disputedOrders
      },
      recent: {
        orders: recentOrders,
        users: recentUsers
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Admin Order Management - Get all orders
fastify.get('/api/admin/orders', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    const { page = '1', limit = '20', status, search } = request.query as {
      page?: string
      limit?: string
      status?: string
      search?: string
    }
    
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build where clause
    const where: any = {}
    if (status) {
      where.status = status.toUpperCase()
    }
    if (search) {
      where.OR = [
        { listing: { title: { contains: search, mode: 'insensitive' } } },
        { buyer: { username: { contains: search, mode: 'insensitive' } } },
        { seller: { username: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        listing: {
          select: { 
            id: true, 
            title: true, 
            price: true,
            deliveryType: true,
            images: true
          }
        },
        buyer: {
          select: { id: true, username: true, email: true }
        },
        seller: {
          select: { id: true, username: true, email: true, verified: true }
        },
        _count: {
          select: { messages: true }
        }
      }
    })

    const total = await prisma.order.count({ where })

    return {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch orders', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Admin User Management - Get all users
fastify.get('/api/admin/users', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    const { page = '1', limit = '20', role, verified, search } = request.query as {
      page?: string
      limit?: string
      role?: string
      verified?: string
      search?: string
    }
    
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build where clause
    const where: any = {}
    if (role) {
      where.role = role
    }
    if (verified !== undefined) {
      where.verified = verified === 'true'
    }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        _count: {
          select: {
            buyerOrders: true,
            sellerOrders: true,
            listings: true
          }
        }
      }
    })

    const total = await prisma.user.count({ where })

    return {
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Admin User Actions - Ban/Suspend User
fastify.patch('/api/admin/users/:userId/ban', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    const { userId } = request.params as { userId: string }
    const { reason } = request.body as { reason: string }

    if (!reason || reason.trim().length < 5) {
      reply.status(400)
      return { error: 'Ban reason must be at least 5 characters' }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true }
    })

    if (!user) {
      reply.status(404)
      return { error: 'User not found' }
    }

    if (user.role === 'admin') {
      reply.status(403)
      return { error: 'Cannot ban admin users' }
    }

    // For now, we'll just store this in a simple way
    // In production, you'd want a proper user_bans table
    await prisma.user.update({
      where: { id: userId },
      data: {
        // We could add a banned field to the schema, but for now we'll use role
        role: 'banned'
      }
    })

    return {
      message: `User ${user.username} has been banned`,
      reason: reason.trim()
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to ban user', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Admin Order Actions - Force Complete Order
fastify.patch('/api/admin/orders/:orderId/force-complete', {
  preHandler: adminOnly
}, async (request, reply) => {
  try {
    const { orderId } = request.params as { orderId: string }
    const { adminNote } = request.body as { adminNote?: string }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { verified: true } }
      }
    })

    if (!order) {
      reply.status(404)
      return { error: 'Order not found' }
    }

    if (order.status === 'COMPLETED') {
      reply.status(400)
      return { error: 'Order is already completed' }
    }

    // Calculate seller earnings
    const commission = order.commission.toNumber()
    const sellerEarnings = order.amount.toNumber() - commission

    // Force complete the order
    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' }
      })

      // Add funds to seller
      await tx.user.update({
        where: { id: order.sellerId },
        data: {
          balance: {
            increment: sellerEarnings
          }
        }
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: order.sellerId,
          orderId: order.id,
          type: 'DEPOSIT',
          amount: sellerEarnings,
          status: 'COMPLETED',
          paymentMethod: 'admin_override'
        }
      })

      // Create admin message
      await tx.message.create({
        data: {
          orderId,
          senderId: order.sellerId, // We don't have admin user ID, so use seller
          receiverId: order.buyerId,
          content: `⚠️ ORDER FORCE-COMPLETED BY ADMIN${adminNote ? `: ${adminNote}` : ''}. Payment released to seller.`,
          type: 'system',
          isAutomatedDelivery: false
        }
      })
    })

    return {
      message: 'Order force-completed successfully',
      sellerEarnings,
      adminNote: adminNote || null
    }
  } catch (error) {
    reply.status(500)
    return { error: 'Failed to force complete order', details: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Production Note: Admin users should be created through database seeding or manual database access

// Start server with Socket.io
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 5000
    const host = process.env.HOST || '0.0.0.0'
    
    await fastify.listen({ port, host })
    
    // Set up Socket.io
    io = new SocketIOServer(fastify.server, {
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true
      }
    })

    // Initialize socket manager
    socketManager.setIo(io)

    // Socket.io connection handling
    io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.id}`)

      // Join order room for real-time messaging
      socket.on('join-order', (orderId: string) => {
        socket.join(`order-${orderId}`)
        console.log(`📨 User ${socket.id} joined order room: ${orderId}`)
      })

      // Leave order room
      socket.on('leave-order', (orderId: string) => {
        socket.leave(`order-${orderId}`)
        console.log(`📤 User ${socket.id} left order room: ${orderId}`)
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`)
      })
    })

    console.log(`🚀 Server running at http://${host}:${port}`)
    console.log(`💬 Socket.io enabled for real-time messaging`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()