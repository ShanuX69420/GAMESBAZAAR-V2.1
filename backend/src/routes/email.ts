import { FastifyInstance } from 'fastify';
import { emailService } from '../services/emailService';
import { prisma } from '../config/database';

export default async function emailRoutes(fastify: FastifyInstance) {
  // Admin-only middleware
  const adminOnly = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
      const { role } = request.user as { role: string };
      
      if (role !== 'admin') {
        reply.status(403).send({ error: 'Admin access required' });
      }
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  };

  // Test email endpoint (admin only)
  fastify.post('/email/test', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const { email } = request.body as { email: string };

      if (!email) {
        reply.status(400);
        return { error: 'Email address is required' };
      }

      // Send test email
      const success = await emailService.sendTestEmail(email);

      if (success) {
        return { message: 'Test email sent successfully' };
      } else {
        reply.status(500);
        return { error: 'Failed to send test email' };
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      reply.status(500);
      return { error: 'Failed to send test email' };
    }
  });

  // Send welcome email (admin only - for manual user verification)
  fastify.post('/email/welcome', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const { userId } = request.body as { userId: string };

      if (!userId) {
        reply.status(400);
        return { error: 'User ID is required' };
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, email: true }
      });

      if (!user) {
        reply.status(404);
        return { error: 'User not found' };
      }

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.username);

      return { message: `Welcome email sent to ${user.email}` };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      reply.status(500);
      return { error: 'Failed to send welcome email' };
    }
  });

  // Resend order notification (admin only - for troubleshooting)
  fastify.post('/email/order-notification', {
    preHandler: adminOnly
  }, async (request, reply) => {
    try {
      const { orderId, type } = request.body as { 
        orderId: string; 
        type: 'created' | 'paid' | 'delivered' | 'completed' | 'disputed' 
      };

      if (!orderId || !type) {
        reply.status(400);
        return { error: 'Order ID and notification type are required' };
      }

      // Get order details with all related data
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          listing: {
            select: { 
              title: true, 
              price: true,
              deliveryType: true 
            }
          },
          buyer: {
            select: { email: true, username: true }
          },
          seller: {
            select: { email: true, username: true }
          }
        }
      });

      if (!order) {
        reply.status(404);
        return { error: 'Order not found' };
      }

      const orderData = {
        orderId: order.id,
        buyerEmail: order.buyer.email,
        sellerEmail: order.seller.email,
        listingTitle: order.listing.title,
        amount: order.listing.price.toNumber(),
        commission: order.commission.toNumber(),
        total: order.amount.toNumber(),
        paymentMethod: order.paymentMethod || undefined
      };

      // Send appropriate notification
      switch (type) {
        case 'created':
          await emailService.sendOrderCreatedNotification(orderData);
          break;
        case 'paid':
          await emailService.sendOrderPaidNotification(orderData);
          break;
        case 'delivered':
          await emailService.sendOrderDeliveredNotification(orderData);
          break;
        case 'completed':
          await emailService.sendOrderCompletedNotification(orderData);
          break;
        case 'disputed':
          await emailService.sendOrderDisputedNotification(orderData);
          break;
        default:
          reply.status(400);
          return { error: 'Invalid notification type' };
      }

      return { message: `${type} notification sent successfully` };
    } catch (error) {
      console.error('Error sending order notification:', error);
      reply.status(500);
      return { error: 'Failed to send order notification' };
    }
  });

  // Get email configuration status (admin only)
  fastify.get('/email/config', {
    preHandler: adminOnly
  }, async (request, reply) => {
    return {
      configured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || '587',
      fromEmail: process.env.EMAIL_FROM || 'Pakistan Gaming Marketplace <noreply@pmv2.com>',
      mode: process.env.SMTP_USER ? 'production' : 'development'
    };
  });
}