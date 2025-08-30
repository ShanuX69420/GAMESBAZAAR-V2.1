import nodemailer from 'nodemailer';

export const emailConfig = {
  // SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  },
  
  // Default email configuration
  defaults: {
    from: process.env.EMAIL_FROM || 'Pakistan Gaming Marketplace <noreply@pmv2.com>',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@pmv2.com'
  },

  // Email templates configuration
  templates: {
    orderCreated: {
      subject: 'New Order Created - Payment Required',
      buyerSubject: 'Your Order is Created - Payment Required',
      sellerSubject: 'New Order Received - Awaiting Payment'
    },
    orderPaid: {
      subject: 'Order Payment Confirmed',
      buyerSubject: 'Payment Confirmed - Awaiting Delivery',
      sellerSubject: 'Payment Received - Deliver Your Item'
    },
    orderDelivered: {
      subject: 'Order Delivered',
      buyerSubject: 'Your Item Has Been Delivered',
      sellerSubject: 'Delivery Confirmed - Awaiting Completion'
    },
    orderCompleted: {
      subject: 'Order Completed Successfully',
      buyerSubject: 'Order Completed - Thank You!',
      sellerSubject: 'Order Completed - Payment Released'
    },
    orderDisputed: {
      subject: 'Order Dispute Initiated',
      buyerSubject: 'Your Dispute Has Been Filed',
      sellerSubject: 'Dispute Filed for Your Order'
    },
    welcomeEmail: {
      subject: 'Welcome to Pakistan Gaming Marketplace!'
    },
    withdrawalRequest: {
      subject: 'Withdrawal Request Submitted',
      adminSubject: 'New Withdrawal Request - Action Required'
    },
    withdrawalApproved: {
      subject: 'Withdrawal Approved - Payment Processing'
    },
    withdrawalRejected: {
      subject: 'Withdrawal Request Rejected'
    }
  }
};

// Create email transporter
export const createEmailTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ Email configuration missing - emails will not be sent');
    return null;
  }

  try {
    const transporter = nodemailer.createTransport(emailConfig.smtp);
    return transporter;
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    return null;
  }
};