import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function profileRoutes(fastify: FastifyInstance) {
  // Middleware to require authentication
  const authRequired = async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  // Get user profile
  fastify.get('/profile', {
    preHandler: authRequired
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
          avatarUrl: true,
          bio: true,
          languages: true,
          vacationMode: true,
          lastBoostAt: true,
          createdAt: true,
          _count: {
            select: {
              listings: { where: { active: true } },
              sellerOrders: { where: { status: 'COMPLETED' } },
              reviews: true
            }
          }
        }
      })

      if (!user) {
        reply.status(404)
        return { error: 'User not found' }
      }

      // Calculate seller stats
      const reviews = await prisma.review.aggregate({
        where: { sellerId: userId },
        _avg: { rating: true },
        _count: { rating: true }
      })

      const stats = {
        totalListings: user._count.listings,
        completedSales: user._count.sellerOrders,
        totalReviews: reviews._count.rating,
        averageRating: reviews._avg.rating || 0
      }

      return {
        ...user,
        _count: undefined,
        stats
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch profile', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Update user profile
  fastify.patch('/profile', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { bio, languages, avatarUrl } = request.body as {
        bio?: string
        languages?: string[]
        avatarUrl?: string
      }

      // Validation
      if (bio && bio.length > 500) {
        reply.status(400)
        return { error: 'Bio cannot exceed 500 characters' }
      }

      if (languages && (!Array.isArray(languages) || languages.length === 0)) {
        reply.status(400)
        return { error: 'Languages must be a non-empty array' }
      }

      const validLanguages = ['English', 'Urdu', 'Hindi', 'Arabic', 'Punjabi']
      if (languages && !languages.every(lang => validLanguages.includes(lang))) {
        reply.status(400)
        return { error: 'Invalid language selection' }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(bio !== undefined && { bio }),
          ...(languages !== undefined && { languages }),
          ...(avatarUrl !== undefined && { avatarUrl })
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          verified: true,
          balance: true,
          avatarUrl: true,
          bio: true,
          languages: true,
          vacationMode: true,
          lastBoostAt: true,
          createdAt: true
        }
      })

      return {
        message: 'Profile updated successfully',
        user: updatedUser
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to update profile', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Toggle vacation mode
  fastify.patch('/profile/vacation-mode', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { enabled } = request.body as { enabled: boolean }

      if (typeof enabled !== 'boolean') {
        reply.status(400)
        return { error: 'enabled field must be a boolean' }
      }

      // Update user vacation mode
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { vacationMode: enabled }
      })

      // If enabling vacation mode, hide all active listings
      // If disabling, show all previously hidden listings
      if (enabled) {
        await prisma.listing.updateMany({
          where: { 
            sellerId: userId,
            active: true,
            hidden: false
          },
          data: { hidden: true }
        })
      } else {
        await prisma.listing.updateMany({
          where: { 
            sellerId: userId,
            hidden: true
          },
          data: { hidden: false }
        })
      }

      const affectedListings = await prisma.listing.count({
        where: { sellerId: userId }
      })

      return {
        message: `Vacation mode ${enabled ? 'enabled' : 'disabled'} successfully`,
        vacationMode: updatedUser.vacationMode,
        affectedListings
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to toggle vacation mode', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Boost listings (free boost every 4 hours)
  fastify.post('/profile/boost', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { gameId } = request.body as { gameId: string }

      if (!gameId) {
        reply.status(400)
        return { error: 'Game ID is required' }
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastBoostAt: true }
      })

      if (!user) {
        reply.status(404)
        return { error: 'User not found' }
      }

      // Check if 4 hours have passed since last boost
      const now = new Date()
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)

      if (user.lastBoostAt && user.lastBoostAt > fourHoursAgo) {
        const remainingTime = Math.ceil((user.lastBoostAt.getTime() + 4 * 60 * 60 * 1000 - now.getTime()) / (1000 * 60))
        reply.status(429)
        return { 
          error: 'Boost cooldown active',
          remainingMinutes: remainingTime,
          message: `You can boost again in ${remainingTime} minutes`
        }
      }

      // Verify game exists
      const game = await prisma.game.findUnique({
        where: { id: gameId }
      })

      if (!game) {
        reply.status(404)
        return { error: 'Game not found' }
      }

      // Clear existing boosts for this game (only one seller can be boosted per game)
      await prisma.listing.updateMany({
        where: { 
          gameId,
          boostedAt: { not: null }
        },
        data: { boostedAt: null }
      })

      // Boost all user's active listings for this game
      const boostedListings = await prisma.listing.updateMany({
        where: {
          sellerId: userId,
          gameId,
          active: true,
          hidden: false
        },
        data: { boostedAt: now }
      })

      // Update user's last boost time
      await prisma.user.update({
        where: { id: userId },
        data: { lastBoostAt: now }
      })

      return {
        message: 'Listings boosted successfully',
        game: game.name,
        boostedCount: boostedListings.count,
        nextBoostAvailable: new Date(now.getTime() + 4 * 60 * 60 * 1000)
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to boost listings', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Get public seller profile
  fastify.get('/seller/:username', async (request, reply) => {
    try {
      const { username } = request.params as { username: string }

      const seller = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
        select: {
          id: true,
          username: true,
          role: true,
          verified: true,
          avatarUrl: true,
          bio: true,
          languages: true,
          vacationMode: true,
          createdAt: true
        }
      })

      if (!seller) {
        reply.status(404)
        return { error: 'Seller not found' }
      }

      // Get seller statistics
      const [
        totalSales,
        totalListings,
        reviews,
        recentOrders
      ] = await Promise.all([
        // Total completed sales
        prisma.order.count({
          where: { 
            sellerId: seller.id, 
            status: 'COMPLETED' 
          }
        }),

        // Active listings count
        prisma.listing.count({
          where: { 
            sellerId: seller.id, 
            active: true,
            hidden: false
          }
        }),
        
        // Reviews and ratings
        prisma.review.aggregate({
          where: { sellerId: seller.id },
          _avg: { rating: true },
          _count: { rating: true }
        }),

        // Recent orders for response time calculation
        prisma.order.findMany({
          where: { 
            sellerId: seller.id,
            status: { in: ['COMPLETED', 'DELIVERED'] }
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { 
            createdAt: true,
            messages: {
              where: { senderId: seller.id },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { createdAt: true }
            }
          }
        })
      ])

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

      // Calculate completion rate
      const totalOrdersCount = await prisma.order.count({
        where: { sellerId: seller.id }
      })
      
      const completionRate = totalOrdersCount > 0 
        ? Math.round((totalSales / totalOrdersCount) * 100)
        : 100

      const stats = {
        totalSales,
        totalListings,
        totalReviews: reviews._count.rating,
        averageRating: reviews._avg.rating || 0,
        responseTime: formatResponseTime(avgResponseTime),
        completionRate
      }

      // Get recent active listings (max 6)
      const recentListings = await prisma.listing.findMany({
        where: {
          sellerId: seller.id,
          active: true,
          hidden: false
        },
        orderBy: [
          { boostedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' }
        ],
        take: 6,
        include: {
          game: {
            select: { id: true, name: true, slug: true }
          },
          category: {
            select: { id: true, name: true, slug: true }
          }
        }
      })

      return {
        seller: {
          ...seller,
          memberSince: seller.createdAt
        },
        stats,
        recentListings
      }
    } catch (error) {
      console.error('Error fetching seller profile:', error)
      reply.status(500)
      return { error: 'Failed to fetch seller profile' }
    }
  })
}

export default profileRoutes