import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listingsRoutes(fastify: FastifyInstance) {
  // Middleware to require authentication
  const authRequired = async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  // Get user's listings with detailed info
  fastify.get('/listings/my', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { page = '1', limit = '10', status = 'all' } = request.query as { 
        page?: string, 
        limit?: string,
        status?: string 
      }
      
      const pageNum = parseInt(page)
      const limitNum = parseInt(limit)
      const skip = (pageNum - 1) * limitNum

      // Build where clause
      const where: any = { sellerId: userId }
      
      if (status !== 'all') {
        switch (status) {
          case 'active':
            where.active = true
            where.hidden = false
            break
          case 'inactive':
            where.active = false
            break
          case 'hidden':
            where.hidden = true
            break
          case 'boosted':
            where.boostedAt = { not: null }
            break
        }
      }

      const listings = await prisma.listing.findMany({
        where,
        orderBy: [
          { boostedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' }
        ],
        skip,
        take: limitNum,
        include: {
          game: {
            select: { id: true, name: true, slug: true, imageUrl: true }
          },
          category: {
            select: { id: true, name: true, slug: true, commissionRate: true }
          },
          _count: {
            select: {
              orders: true
            }
          }
        }
      })

      const total = await prisma.listing.count({ where })

      // Get order statistics for each listing
      const listingsWithStats = await Promise.all(
        listings.map(async (listing) => {
          const orders = await prisma.order.findMany({
            where: { listingId: listing.id },
            select: { status: true, createdAt: true }
          })

          const totalOrders = orders.length
          const completedOrders = orders.filter(order => order.status === 'COMPLETED').length
          const pendingOrders = orders.filter(order => order.status === 'PENDING').length
          
          // Check if boost is available (4 hours since last boost)
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lastBoostAt: true }
          })
          
          const now = new Date()
          const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)
          const canBoost = !user?.lastBoostAt || user.lastBoostAt <= fourHoursAgo

          return {
            ...listing,
            stats: {
              totalOrders,
              completedOrders,
              pendingOrders,
              views: 0 // We don't track views yet, placeholder
            },
            canBoost,
            boostExpiresAt: listing.boostedAt ? new Date(listing.boostedAt.getTime() + 24 * 60 * 60 * 1000) : null
          }
        })
      )

      return {
        listings: listingsWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch listings', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Create new listing
  fastify.post('/listings', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { 
        gameId, 
        categoryId, 
        title, 
        price, 
        description, 
        deliveryType, 
        stockType, 
        quantity, 
        images, 
        customFields 
      } = request.body as {
        gameId: string
        categoryId: string
        title: string
        price: number
        description: string
        deliveryType: 'instant' | 'manual'
        stockType: 'limited' | 'unlimited'
        quantity?: number
        images?: string[]
        customFields?: any
      }

      // Validation
      if (!gameId || !categoryId || !title || !price || !description || !deliveryType || !stockType) {
        reply.status(400)
        return { error: 'All required fields must be provided' }
      }

      if (title.length < 5 || title.length > 100) {
        reply.status(400)
        return { error: 'Title must be between 5 and 100 characters' }
      }

      if (description.length < 20 || description.length > 1000) {
        reply.status(400)
        return { error: 'Description must be between 20 and 1000 characters' }
      }

      if (price <= 0 || price > 1000000) {
        reply.status(400)
        return { error: 'Price must be between 1 and 1,000,000 PKR' }
      }

      if (stockType === 'limited' && (!quantity || quantity <= 0)) {
        reply.status(400)
        return { error: 'Quantity is required for limited stock items' }
      }

      if (images && images.length > 5) {
        reply.status(400)
        return { error: 'Maximum 5 images allowed per listing' }
      }

      // Verify game and category exist
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: { game: true }
      })

      if (!category || category.gameId !== gameId) {
        reply.status(404)
        return { error: 'Game or category not found' }
      }

      // Check user listing limits (3 per category per game)
      const existingListings = await prisma.listing.count({
        where: {
          sellerId: userId,
          gameId,
          categoryId,
          active: true
        }
      })

      if (existingListings >= 3) {
        reply.status(403)
        return { error: 'Maximum 3 active listings per category per game. Please delete existing listings or contact support.' }
      }

      // Check if user is in vacation mode
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { vacationMode: true }
      })

      const listing = await prisma.listing.create({
        data: {
          sellerId: userId,
          gameId,
          categoryId,
          title: title.trim(),
          price,
          description: description.trim(),
          deliveryType,
          stockType,
          quantity: stockType === 'limited' ? quantity : null,
          images: images || [],
          customFields: customFields || {},
          hidden: user?.vacationMode || false, // Auto-hide if in vacation mode
          active: true
        },
        include: {
          seller: {
            select: { id: true, username: true, verified: true }
          },
          game: {
            select: { id: true, name: true, slug: true }
          },
          category: {
            select: { id: true, name: true, slug: true, commissionRate: true }
          }
        }
      })

      return { 
        message: 'Listing created successfully',
        listing,
        warning: user?.vacationMode ? 'Listing created but hidden due to vacation mode' : null
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to create listing', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Update existing listing
  fastify.patch('/listings/:listingId', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { listingId } = request.params as { listingId: string }
      const { 
        title, 
        price, 
        description, 
        deliveryType, 
        stockType, 
        quantity, 
        images, 
        customFields 
      } = request.body as {
        title?: string
        price?: number
        description?: string
        deliveryType?: 'instant' | 'manual'
        stockType?: 'limited' | 'unlimited'
        quantity?: number
        images?: string[]
        customFields?: any
      }

      // Get existing listing
      const existingListing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { category: true }
      })

      if (!existingListing) {
        reply.status(404)
        return { error: 'Listing not found' }
      }

      if (existingListing.sellerId !== userId) {
        reply.status(403)
        return { error: 'You can only edit your own listings' }
      }

      // Validation for provided fields
      if (title && (title.length < 5 || title.length > 100)) {
        reply.status(400)
        return { error: 'Title must be between 5 and 100 characters' }
      }

      if (description && (description.length < 20 || description.length > 1000)) {
        reply.status(400)
        return { error: 'Description must be between 20 and 1000 characters' }
      }

      if (price && (price <= 0 || price > 1000000)) {
        reply.status(400)
        return { error: 'Price must be between 1 and 1,000,000 PKR' }
      }

      const finalStockType = stockType || existingListing.stockType
      if (finalStockType === 'limited' && quantity !== undefined && quantity <= 0) {
        reply.status(400)
        return { error: 'Quantity must be greater than 0 for limited stock items' }
      }

      if (images && images.length > 5) {
        reply.status(400)
        return { error: 'Maximum 5 images allowed per listing' }
      }

      const updatedListing = await prisma.listing.update({
        where: { id: listingId },
        data: {
          ...(title && { title: title.trim() }),
          ...(price && { price }),
          ...(description && { description: description.trim() }),
          ...(deliveryType && { deliveryType }),
          ...(stockType && { stockType }),
          ...(quantity !== undefined && { 
            quantity: finalStockType === 'limited' ? quantity : null 
          }),
          ...(images && { images }),
          ...(customFields && { customFields })
        },
        include: {
          game: {
            select: { id: true, name: true, slug: true }
          },
          category: {
            select: { id: true, name: true, slug: true, commissionRate: true }
          }
        }
      })

      return {
        message: 'Listing updated successfully',
        listing: updatedListing
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to update listing', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Toggle listing active status (pause/unpause)
  fastify.patch('/listings/:listingId/toggle', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { listingId } = request.params as { listingId: string }

      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { sellerId: true, active: true, title: true }
      })

      if (!listing) {
        reply.status(404)
        return { error: 'Listing not found' }
      }

      if (listing.sellerId !== userId) {
        reply.status(403)
        return { error: 'You can only toggle your own listings' }
      }

      const updatedListing = await prisma.listing.update({
        where: { id: listingId },
        data: { active: !listing.active }
      })

      return {
        message: `Listing ${updatedListing.active ? 'activated' : 'deactivated'} successfully`,
        title: listing.title,
        active: updatedListing.active
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to toggle listing', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Delete listing
  fastify.delete('/listings/:listingId', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { listingId } = request.params as { listingId: string }

      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { 
          sellerId: true, 
          title: true,
          _count: {
            select: {
              orders: {
                where: {
                  status: { in: ['PENDING', 'PAID', 'DELIVERED'] }
                }
              }
            }
          }
        }
      })

      if (!listing) {
        reply.status(404)
        return { error: 'Listing not found' }
      }

      if (listing.sellerId !== userId) {
        reply.status(403)
        return { error: 'You can only delete your own listings' }
      }

      // Check if there are active orders
      if (listing._count.orders > 0) {
        reply.status(400)
        return { error: 'Cannot delete listing with active orders. Please complete or cancel all orders first.' }
      }

      await prisma.listing.delete({
        where: { id: listingId }
      })

      return {
        message: 'Listing deleted successfully',
        title: listing.title
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to delete listing', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Copy/duplicate listing
  fastify.post('/listings/:listingId/copy', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string }
      const { listingId } = request.params as { listingId: string }

      const originalListing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { 
          category: true,
          game: true 
        }
      })

      if (!originalListing) {
        reply.status(404)
        return { error: 'Listing not found' }
      }

      if (originalListing.sellerId !== userId) {
        reply.status(403)
        return { error: 'You can only copy your own listings' }
      }

      // Check listing limits
      const existingListings = await prisma.listing.count({
        where: {
          sellerId: userId,
          gameId: originalListing.gameId,
          categoryId: originalListing.categoryId,
          active: true
        }
      })

      if (existingListings >= 3) {
        reply.status(403)
        return { error: 'Maximum 3 active listings per category per game. Please delete existing listings first.' }
      }

      // Check if user is in vacation mode
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { vacationMode: true }
      })

      const copiedListing = await prisma.listing.create({
        data: {
          sellerId: userId,
          gameId: originalListing.gameId,
          categoryId: originalListing.categoryId,
          title: `${originalListing.title} (Copy)`,
          price: originalListing.price,
          description: originalListing.description,
          deliveryType: originalListing.deliveryType,
          stockType: originalListing.stockType,
          quantity: originalListing.quantity,
          images: originalListing.images,
          customFields: originalListing.customFields as any,
          hidden: user?.vacationMode || false,
          active: true
        },
        include: {
          game: {
            select: { id: true, name: true, slug: true }
          },
          category: {
            select: { id: true, name: true, slug: true, commissionRate: true }
          }
        }
      })

      return {
        message: 'Listing copied successfully',
        listing: copiedListing,
        warning: user?.vacationMode ? 'Listing copied but hidden due to vacation mode' : null
      }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to copy listing', details: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Get listing creation options (games and categories)
  fastify.get('/listings/options', {
    preHandler: authRequired
  }, async (request, reply) => {
    try {
      const games = await prisma.game.findMany({
        where: { active: true },
        orderBy: { orderIndex: 'asc' },
        include: {
          categories: {
            where: { active: true },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              slug: true,
              commissionRate: true,
              fieldsConfig: true
            }
          }
        }
      })

      return { games }
    } catch (error) {
      reply.status(500)
      return { error: 'Failed to fetch listing options' }
    }
  })
}

export default listingsRoutes