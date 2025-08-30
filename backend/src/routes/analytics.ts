import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // Admin-only middleware
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

  // Enhanced Analytics Dashboard
  fastify.get('/admin/analytics/overview', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const [
        // Core metrics
        totalUsers,
        totalOrders,
        totalListings,
        totalRevenue,
        
        // Time-based metrics
        usersLast30Days,
        usersLast7Days,
        usersLast24Hours,
        ordersLast30Days,
        ordersLast7Days,
        ordersLast24Hours,
        
        // Status breakdown
        completedOrders,
        pendingOrders,
        disputedOrders,
        refundedOrders,
        
        // Financial metrics
        revenueToday,
        revenueLast7Days,
        revenueLast30Days,
        
        // User breakdown
        verifiedUsers,
        adminUsers,
        bannedUsers,
        
        // Listing metrics
        activeListings,
        hiddenListings,
        boostedListings
      ] = await Promise.all([
        // Core counts
        prisma.user.count(),
        prisma.order.count(),
        prisma.listing.count(),
        prisma.order.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { commission: true }
        }),
        
        // User registrations over time
        prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
        
        // Orders over time
        prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.order.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
        
        // Order status breakdown
        prisma.order.count({ where: { status: 'COMPLETED' } }),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.order.count({ where: { status: 'DISPUTED' } }),
        prisma.order.count({ where: { status: 'REFUNDED' } }),
        
        // Revenue breakdown
        prisma.order.aggregate({
          where: { 
            status: 'COMPLETED',
            createdAt: { gte: twentyFourHoursAgo }
          },
          _sum: { commission: true }
        }),
        prisma.order.aggregate({
          where: { 
            status: 'COMPLETED',
            createdAt: { gte: sevenDaysAgo }
          },
          _sum: { commission: true }
        }),
        prisma.order.aggregate({
          where: { 
            status: 'COMPLETED',
            createdAt: { gte: thirtyDaysAgo }
          },
          _sum: { commission: true }
        }),
        
        // User type breakdown
        prisma.user.count({ where: { verified: true } }),
        prisma.user.count({ where: { role: 'admin' } }),
        prisma.user.count({ where: { role: 'banned' } }),
        
        // Listing status breakdown
        prisma.listing.count({ where: { active: true, hidden: false } }),
        prisma.listing.count({ where: { hidden: true } }),
        prisma.listing.count({ where: { boostedAt: { not: null } } })
      ])

      return {
        overview: {
          totalUsers,
          totalOrders,
          totalListings,
          totalRevenue: totalRevenue._sum.commission || 0,
          averageOrderValue: totalOrders > 0 ? Number(totalRevenue._sum.commission || 0) / completedOrders : 0
        },
        growth: {
          users: {
            total: totalUsers,
            last30Days: usersLast30Days,
            last7Days: usersLast7Days,
            last24Hours: usersLast24Hours
          },
          orders: {
            total: totalOrders,
            last30Days: ordersLast30Days,
            last7Days: ordersLast7Days,
            last24Hours: ordersLast24Hours
          }
        },
        financial: {
          totalRevenue: totalRevenue._sum.commission || 0,
          revenueToday: revenueToday._sum.commission || 0,
          revenueLast7Days: revenueLast7Days._sum.commission || 0,
          revenueLast30Days: revenueLast30Days._sum.commission || 0
        },
        orders: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          disputed: disputedOrders,
          refunded: refundedOrders,
          completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0
        },
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          admin: adminUsers,
          banned: bannedUsers,
          regular: totalUsers - verifiedUsers - adminUsers - bannedUsers
        },
        listings: {
          total: totalListings,
          active: activeListings,
          hidden: hiddenListings,
          boosted: boostedListings
        }
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch analytics overview', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Daily Revenue Chart Data (Last 30 days)
  fastify.get('/admin/analytics/revenue-chart', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Get completed orders for the last 30 days grouped by date
      const completedOrders = await prisma.order.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: thirtyDaysAgo }
        },
        select: {
          createdAt: true,
          commission: true
        }
      })

      // Group by date and calculate daily revenue
      const dailyRevenueMap = new Map<string, { revenue: number; orders: number }>()
      
      completedOrders.forEach(order => {
        const dateStr = order.createdAt.toISOString().split('T')[0]
        const existing = dailyRevenueMap.get(dateStr) || { revenue: 0, orders: 0 }
        dailyRevenueMap.set(dateStr, {
          revenue: existing.revenue + order.commission.toNumber(),
          orders: existing.orders + 1
        })
      })

      // Fill in missing dates with 0 revenue
      const chartData = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayData = dailyRevenueMap.get(dateStr)
        
        chartData.push({
          date: dateStr,
          revenue: dayData ? dayData.revenue : 0,
          orders: dayData ? dayData.orders : 0
        })
      }

      return { chartData }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch revenue chart data', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Top Selling Games Analytics
  fastify.get('/admin/analytics/top-games', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const { timeframe = '30' } = request.query as { timeframe?: string }
      const days = parseInt(timeframe)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Get games with their associated orders and listings
      const gamesWithStats = await prisma.game.findMany({
        include: {
          listings: {
            include: {
              orders: {
                where: {
                  status: 'COMPLETED',
                  ...(days > 0 ? { createdAt: { gte: startDate } } : {})
                }
              }
            }
          }
        }
      })

      // Calculate statistics for each game
      const topGames = gamesWithStats.map(game => {
        const allOrders = game.listings.flatMap(listing => listing.orders)
        const uniqueSellers = new Set(game.listings.map(listing => listing.sellerId))
        
        return {
          id: game.id,
          name: game.name,
          slug: game.slug,
          imageUrl: game.imageUrl,
          totalOrders: allOrders.length,
          totalVolume: allOrders.reduce((sum, order) => sum + order.amount.toNumber(), 0),
          totalCommission: allOrders.reduce((sum, order) => sum + order.commission.toNumber(), 0),
          activeSellers: uniqueSellers.size,
          totalListings: game.listings.length
        }
      }).filter(game => game.totalOrders > 0)
        .sort((a, b) => b.totalOrders - a.totalOrders)
        .slice(0, 10)

      return {
        topGames: topGames.map(game => ({
          ...game,
          totalOrders: Number(game.totalOrders),
          totalVolume: Number(game.totalVolume),
          totalCommission: Number(game.totalCommission),
          activeSellers: Number(game.activeSellers),
          totalListings: Number(game.totalListings)
        }))
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch top games analytics', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Top Sellers Analytics
  fastify.get('/admin/analytics/top-sellers', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const { timeframe = '30' } = request.query as { timeframe?: string }
      const days = parseInt(timeframe)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Get users with their associated orders, reviews, and listings
      const usersWithStats = await prisma.user.findMany({
        where: { role: { not: 'admin' } },
        include: {
          sellerOrders: {
            where: {
              status: 'COMPLETED',
              ...(days > 0 ? { createdAt: { gte: startDate } } : {})
            }
          },
          reviews: true,
          listings: {
            where: {
              active: true,
              hidden: false
            }
          }
        }
      })

      // Calculate statistics for each seller
      const topSellers = usersWithStats.map(user => {
        const totalSales = user.sellerOrders.length
        const totalEarnings = user.sellerOrders.reduce((sum: number, order: any) => 
          sum + (order.amount.toNumber() - order.commission.toNumber()), 0)
        const platformCommission = user.sellerOrders.reduce((sum: number, order: any) => 
          sum + order.commission.toNumber(), 0)
        const averageRating = user.reviews.length > 0 
          ? user.reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / user.reviews.length
          : 0
        
        return {
          id: user.id,
          username: user.username,
          verified: user.verified,
          memberSince: user.createdAt,
          totalSales,
          totalEarnings,
          platformCommission,
          averageRating,
          totalReviews: user.reviews.length,
          activeListings: user.listings.length
        }
      }).filter(seller => seller.totalSales > 0)
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 15)

      return {
        topSellers: topSellers.map(seller => ({
          ...seller,
          totalSales: Number(seller.totalSales),
          totalEarnings: Number(seller.totalEarnings),
          platformCommission: Number(seller.platformCommission),
          averageRating: seller.averageRating ? Number(seller.averageRating) : 0,
          totalReviews: Number(seller.totalReviews),
          activeListings: Number(seller.activeListings)
        }))
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch top sellers analytics', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Platform Health Metrics
  fastify.get('/admin/analytics/health-metrics', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const now = new Date()
      const today = new Date(now.setHours(0, 0, 0, 0))
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const [
        // Order statistics
        allOrders,
        disputedOrders,
        completedOrders,
        
        // Recent activity counts
        newUsersToday,
        ordersToday,
        listingsToday,
        
        // Active users data
        recentOrdersForUsers,
        recentMessagesForUsers
      ] = await Promise.all([
        // Get all orders for completion rate and dispute rate
        prisma.order.findMany({ select: { status: true, amount: true } }),
        prisma.order.count({ where: { status: 'DISPUTED' } }),
        prisma.order.count({ where: { status: 'COMPLETED' } }),
        
        // Today's activity
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.order.count({ where: { createdAt: { gte: today } } }),
        prisma.listing.count({ where: { createdAt: { gte: today } } }),
        
        // Get recent orders for active users calculation
        prisma.order.findMany({
          where: { createdAt: { gte: monthAgo } },
          select: { buyerId: true, sellerId: true, createdAt: true }
        }),
        
        // Get recent messages for active users calculation
        prisma.message.findMany({
          where: { createdAt: { gte: monthAgo } },
          select: { senderId: true, createdAt: true }
        })
      ])

      // Calculate metrics
      const totalOrders = allOrders.length
      const disputeRate = totalOrders > 0 ? (disputedOrders / totalOrders) * 100 : 0
      const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
      const averageOrderValue = completedOrders > 0 
        ? allOrders.filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + o.amount.toNumber(), 0) / completedOrders
        : 0

      // Calculate active users
      const dailyActiveUserIds = new Set<string>()
      const weeklyActiveUserIds = new Set<string>()
      const monthlyActiveUserIds = new Set<string>()

      // Add users from orders
      recentOrdersForUsers.forEach(order => {
        const orderDate = new Date(order.createdAt)
        if (orderDate >= today) {
          dailyActiveUserIds.add(order.buyerId)
          dailyActiveUserIds.add(order.sellerId)
        }
        if (orderDate >= weekAgo) {
          weeklyActiveUserIds.add(order.buyerId)
          weeklyActiveUserIds.add(order.sellerId)
        }
        monthlyActiveUserIds.add(order.buyerId)
        monthlyActiveUserIds.add(order.sellerId)
      })

      // Add users from messages
      recentMessagesForUsers.forEach(message => {
        const messageDate = new Date(message.createdAt)
        if (messageDate >= today) {
          dailyActiveUserIds.add(message.senderId)
        }
        if (messageDate >= weekAgo) {
          weeklyActiveUserIds.add(message.senderId)
        }
        monthlyActiveUserIds.add(message.senderId)
      })

      return {
        disputes: {
          rate: disputeRate,
          total: disputedOrders,
          averageResolutionTime: 0 // Simplified for now
        },
        responseTime: {
          averageSellerResponse: 0 // Simplified for now
        },
        activity: {
          dailyActiveUsers: dailyActiveUserIds.size,
          weeklyActiveUsers: weeklyActiveUserIds.size,
          monthlyActiveUsers: monthlyActiveUserIds.size
        },
        orders: {
          completionRate: completionRate,
          averageValue: averageOrderValue
        },
        today: {
          newUsers: newUsersToday,
          orders: ordersToday,
          listings: listingsToday
        }
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch health metrics', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Recent Activity Feed
  fastify.get('/admin/analytics/recent-activity', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const { limit = '20' } = request.query as { limit?: string }
      const limitNum = Math.min(parseInt(limit), 50)

      const [recentOrders, recentUsers, recentListings, recentDisputes] = await Promise.all([
        // Recent orders
        prisma.order.findMany({
          take: Math.ceil(limitNum / 4),
          orderBy: { createdAt: 'desc' },
          include: {
            listing: { select: { title: true } },
            buyer: { select: { username: true } },
            seller: { select: { username: true } }
          }
        }),
        
        // Recent user registrations
        prisma.user.findMany({
          take: Math.ceil(limitNum / 4),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            username: true,
            email: true,
            verified: true,
            createdAt: true
          }
        }),
        
        // Recent listings
        prisma.listing.findMany({
          take: Math.ceil(limitNum / 4),
          orderBy: { createdAt: 'desc' },
          include: {
            seller: { select: { username: true } },
            game: { select: { name: true } },
            category: { select: { name: true } }
          }
        }),
        
        // Recent disputes
        prisma.order.findMany({
          where: { status: 'DISPUTED' },
          take: Math.ceil(limitNum / 4),
          orderBy: { createdAt: 'desc' },
          include: {
            listing: { select: { title: true } },
            buyer: { select: { username: true } },
            seller: { select: { username: true } }
          }
        })
      ])

      // Combine and sort all activities by timestamp
      const activities = [
        ...recentOrders.map(order => ({
          type: 'order',
          timestamp: order.createdAt,
          data: {
            id: order.id,
            status: order.status,
            amount: order.amount.toString(),
            listing: order.listing.title,
            buyer: order.buyer.username,
            seller: order.seller.username
          }
        })),
        ...recentUsers.map(user => ({
          type: 'user_registration',
          timestamp: user.createdAt,
          data: {
            id: user.id,
            username: user.username,
            email: user.email,
            verified: user.verified
          }
        })),
        ...recentListings.map(listing => ({
          type: 'listing',
          timestamp: listing.createdAt,
          data: {
            id: listing.id,
            title: listing.title,
            price: listing.price.toString(),
            seller: listing.seller.username,
            game: listing.game.name,
            category: listing.category.name
          }
        })),
        ...recentDisputes.map(dispute => ({
          type: 'dispute',
          timestamp: dispute.createdAt,
          data: {
            id: dispute.id,
            listing: dispute.listing.title,
            buyer: dispute.buyer.username,
            seller: dispute.seller.username,
            amount: dispute.amount.toString()
          }
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limitNum)

      return { activities }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch recent activity', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

export default analyticsRoutes