import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateReviewRequest {
  Body: {
    orderId: string;
    rating: number;
    comment: string;
  };
}

interface ReviewParams {
  Params: {
    orderId: string;
  };
}

interface SellerReviewsParams {
  Params: {
    sellerId: string;
  };
  Querystring: {
    page?: number;
    limit?: number;
  };
}

export default async function reviewsRoutes(fastify: FastifyInstance) {
  // Middleware to require authentication
  const authRequired = async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  // Create a review for a completed order
  fastify.post<CreateReviewRequest>('/reviews', {
    preHandler: authRequired
  }, async (request: FastifyRequest<CreateReviewRequest>, reply: FastifyReply) => {
    try {
      const { orderId, rating, comment } = request.body;
      const { userId } = request.user as { userId: string };

      // Validate rating
      if (!rating || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Rating must be between 1 and 5' });
      }

      // Validate comment
      if (!comment || comment.trim().length === 0) {
        return reply.status(400).send({ error: 'Comment is required' });
      }

      if (comment.length > 500) {
        return reply.status(400).send({ error: 'Comment must be 500 characters or less' });
      }

      // Get the order and verify it's completed and user is the buyer
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          buyerId: userId,
          status: 'COMPLETED'
        },
        include: {
          seller: true,
          listing: true
        }
      });

      if (!order) {
        return reply.status(404).send({ 
          error: 'Order not found, not completed, or you are not the buyer' 
        });
      }

      // Check if review already exists
      const existingReview = await prisma.review.findUnique({
        where: { orderId }
      });

      if (existingReview) {
        return reply.status(400).send({ error: 'Review already exists for this order' });
      }

      // Create the review
      const review = await prisma.review.create({
        data: {
          orderId,
          buyerId: userId,
          sellerId: order.sellerId,
          rating,
          comment: comment.trim()
        },
        include: {
          order: {
            include: {
              listing: true
            }
          },
          buyer: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Update seller's average rating cache if needed
      const sellerStats = await prisma.review.aggregate({
        where: { sellerId: order.sellerId },
        _avg: { rating: true },
        _count: { id: true }
      });

      await prisma.user.update({
        where: { id: order.sellerId },
        data: {
          averageRating: sellerStats._avg.rating || 0,
          totalReviews: sellerStats._count.id || 0
        }
      });

      reply.send({
        message: 'Review created successfully',
        review
      });
    } catch (error) {
      console.error('Error creating review:', error);
      reply.status(500).send({ error: 'Failed to create review' });
    }
  });

  // Get review for a specific order
  fastify.get<ReviewParams>('/reviews/order/:orderId', {
    preHandler: authRequired
  }, async (request: FastifyRequest<ReviewParams>, reply: FastifyReply) => {
    try {
      const { orderId } = request.params;
      const { userId } = request.user as { userId: string };

      // Verify user is part of this order
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          OR: [
            { buyerId: userId },
            { sellerId: userId }
          ]
        }
      });

      if (!order) {
        return reply.status(404).send({ error: 'Order not found or access denied' });
      }

      const review = await prisma.review.findUnique({
        where: { orderId },
        include: {
          buyer: {
            select: {
              id: true,
              username: true
            }
          },
          order: {
            include: {
              listing: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        }
      });

      if (!review) {
        return reply.status(404).send({ error: 'Review not found' });
      }

      // For public display, hide buyer username (show as "Anonymous buyer")
      // unless the requester is the seller
      const response = {
        ...review,
        buyer: userId === order.sellerId ? review.buyer : { 
          id: 'anonymous', 
          username: 'Anonymous buyer' 
        }
      };

      reply.send(response);
    } catch (error) {
      console.error('Error fetching review:', error);
      reply.status(500).send({ error: 'Failed to fetch review' });
    }
  });

  // Get reviews for a seller
  fastify.get<SellerReviewsParams>('/reviews/seller/:sellerId', async (request: FastifyRequest<SellerReviewsParams>, reply: FastifyReply) => {
    try {
      const { sellerId } = request.params;
      const page = request.query.page || 1;
      const limit = Math.min(request.query.limit || 10, 50);
      const offset = (page - 1) * limit;

      // Get seller to verify they exist
      const seller = await prisma.user.findUnique({
        where: { id: sellerId },
        select: {
          id: true,
          username: true,
          averageRating: true,
          totalReviews: true
        }
      });

      if (!seller) {
        return reply.status(404).send({ error: 'Seller not found' });
      }

      const reviews = await prisma.review.findMany({
        where: { sellerId },
        include: {
          order: {
            include: {
              listing: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const total = await prisma.review.count({
        where: { sellerId }
      });

      // For public display, show as "Anonymous buyer"
      const publicReviews = reviews.map(review => ({
        ...review,
        buyer: { id: 'anonymous', username: 'Anonymous buyer' }
      }));

      reply.send({
        reviews: publicReviews,
        seller: {
          id: seller.id,
          username: seller.username,
          averageRating: Number(seller.averageRating) || 0,
          totalReviews: seller.totalReviews || 0
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching seller reviews:', error);
      reply.status(500).send({ error: 'Failed to fetch reviews' });
    }
  });

  // Check if user can review an order
  fastify.get<ReviewParams>('/reviews/can-review/:orderId', {
    preHandler: authRequired
  }, async (request: FastifyRequest<ReviewParams>, reply: FastifyReply) => {
    try {
      const { orderId } = request.params;
      const { userId } = request.user as { userId: string };

      // Check if order exists, is completed, and user is the buyer
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          buyerId: userId,
          status: 'COMPLETED'
        }
      });

      if (!order) {
        return reply.send({ canReview: false, reason: 'Order not found, not completed, or you are not the buyer' });
      }

      // Check if review already exists
      const existingReview = await prisma.review.findUnique({
        where: { orderId }
      });

      if (existingReview) {
        return reply.send({ canReview: false, reason: 'Review already exists' });
      }

      reply.send({ canReview: true });
    } catch (error) {
      console.error('Error checking review eligibility:', error);
      reply.status(500).send({ error: 'Failed to check review eligibility' });
    }
  });
}