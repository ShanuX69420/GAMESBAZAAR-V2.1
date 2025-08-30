import { createEmailTransporter, emailConfig } from '../config/email';
import { compileTemplate } from '../utils/templateCompiler';
import { prisma } from '../config/database';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface OrderEmailData {
  orderId: string;
  buyerEmail: string;
  sellerEmail: string;
  listingTitle: string;
  amount: number;
  commission: number;
  total: number;
  paymentMethod?: string;
  deliveryMessage?: string;
  disputeReason?: string;
}

export interface WithdrawalEmailData {
  userEmail: string;
  amount: number;
  method: string;
  fee: number;
  netAmount: number;
  reason?: string;
}

export class EmailService {
  private transporter;

  constructor() {
    this.transporter = createEmailTransporter();
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    if (!this.transporter) {
      console.log('📧 [DEV MODE] Email would be sent to:', emailData.to);
      console.log('📧 Subject:', emailData.subject);
      console.log('📧 Content:', emailData.text || emailData.html.substring(0, 100) + '...');
      return true; // Return success in dev mode
    }

    try {
      const mailOptions = {
        from: emailConfig.defaults.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        replyTo: emailConfig.defaults.replyTo
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  // Order-related email notifications
  async sendOrderCreatedNotification(orderData: OrderEmailData): Promise<void> {
    // Send to buyer
    const buyerHtml = await compileTemplate('orderCreated', {
      ...orderData,
      userType: 'buyer',
      recipientRole: 'buyer'
    });

    await this.sendEmail({
      to: orderData.buyerEmail,
      subject: emailConfig.templates.orderCreated.buyerSubject,
      html: buyerHtml
    });

    // Send to seller
    const sellerHtml = await compileTemplate('orderCreated', {
      ...orderData,
      userType: 'seller',
      recipientRole: 'seller'
    });

    await this.sendEmail({
      to: orderData.sellerEmail,
      subject: emailConfig.templates.orderCreated.sellerSubject,
      html: sellerHtml
    });
  }

  async sendOrderPaidNotification(orderData: OrderEmailData): Promise<void> {
    // Send to buyer
    const buyerHtml = await compileTemplate('orderPaid', {
      ...orderData,
      userType: 'buyer',
      recipientRole: 'buyer'
    });

    await this.sendEmail({
      to: orderData.buyerEmail,
      subject: emailConfig.templates.orderPaid.buyerSubject,
      html: buyerHtml
    });

    // Send to seller
    const sellerHtml = await compileTemplate('orderPaid', {
      ...orderData,
      userType: 'seller',
      recipientRole: 'seller'
    });

    await this.sendEmail({
      to: orderData.sellerEmail,
      subject: emailConfig.templates.orderPaid.sellerSubject,
      html: sellerHtml
    });
  }

  async sendOrderDeliveredNotification(orderData: OrderEmailData): Promise<void> {
    // Send to buyer
    const buyerHtml = await compileTemplate('orderDelivered', {
      ...orderData,
      userType: 'buyer',
      recipientRole: 'buyer'
    });

    await this.sendEmail({
      to: orderData.buyerEmail,
      subject: emailConfig.templates.orderDelivered.buyerSubject,
      html: buyerHtml
    });

    // Send to seller
    const sellerHtml = await compileTemplate('orderDelivered', {
      ...orderData,
      userType: 'seller',
      recipientRole: 'seller'
    });

    await this.sendEmail({
      to: orderData.sellerEmail,
      subject: emailConfig.templates.orderDelivered.sellerSubject,
      html: sellerHtml
    });
  }

  async sendOrderCompletedNotification(orderData: OrderEmailData): Promise<void> {
    // Send to buyer
    const buyerHtml = await compileTemplate('orderCompleted', {
      ...orderData,
      userType: 'buyer',
      recipientRole: 'buyer'
    });

    await this.sendEmail({
      to: orderData.buyerEmail,
      subject: emailConfig.templates.orderCompleted.buyerSubject,
      html: buyerHtml
    });

    // Send to seller
    const sellerHtml = await compileTemplate('orderCompleted', {
      ...orderData,
      userType: 'seller',
      recipientRole: 'seller'
    });

    await this.sendEmail({
      to: orderData.sellerEmail,
      subject: emailConfig.templates.orderCompleted.sellerSubject,
      html: sellerHtml
    });
  }

  async sendOrderDisputedNotification(orderData: OrderEmailData): Promise<void> {
    // Send to buyer
    const buyerHtml = await compileTemplate('orderDisputed', {
      ...orderData,
      userType: 'buyer',
      recipientRole: 'buyer'
    });

    await this.sendEmail({
      to: orderData.buyerEmail,
      subject: emailConfig.templates.orderDisputed.buyerSubject,
      html: buyerHtml
    });

    // Send to seller
    const sellerHtml = await compileTemplate('orderDisputed', {
      ...orderData,
      userType: 'seller',
      recipientRole: 'seller'
    });

    await this.sendEmail({
      to: orderData.sellerEmail,
      subject: emailConfig.templates.orderDisputed.sellerSubject,
      html: sellerHtml
    });

    // Send to admin
    const adminEmails = await this.getAdminEmails();
    for (const adminEmail of adminEmails) {
      const adminHtml = await compileTemplate('orderDisputed', {
        ...orderData,
        userType: 'admin',
        recipientRole: 'admin'
      });

      await this.sendEmail({
        to: adminEmail,
        subject: `Admin Alert: ${emailConfig.templates.orderDisputed.subject}`,
        html: adminHtml
      });
    }
  }

  // Welcome email for new users
  async sendWelcomeEmail(userEmail: string, username: string): Promise<void> {
    const html = await compileTemplate('welcome', {
      username,
      userEmail
    });

    await this.sendEmail({
      to: userEmail,
      subject: emailConfig.templates.welcomeEmail.subject,
      html: html
    });
  }

  // Withdrawal-related notifications
  async sendWithdrawalRequestNotification(withdrawalData: WithdrawalEmailData): Promise<void> {
    // Send to user
    const userHtml = await compileTemplate('withdrawalRequest', {
      ...withdrawalData,
      recipientRole: 'user'
    });

    await this.sendEmail({
      to: withdrawalData.userEmail,
      subject: emailConfig.templates.withdrawalRequest.subject,
      html: userHtml
    });

    // Send to admin
    const adminEmails = await this.getAdminEmails();
    for (const adminEmail of adminEmails) {
      const adminHtml = await compileTemplate('withdrawalRequest', {
        ...withdrawalData,
        recipientRole: 'admin',
        adminEmail
      });

      await this.sendEmail({
        to: adminEmail,
        subject: emailConfig.templates.withdrawalRequest.adminSubject,
        html: adminHtml
      });
    }
  }

  async sendWithdrawalApprovedNotification(withdrawalData: WithdrawalEmailData): Promise<void> {
    const html = await compileTemplate('withdrawalApproved', withdrawalData);

    await this.sendEmail({
      to: withdrawalData.userEmail,
      subject: emailConfig.templates.withdrawalApproved.subject,
      html: html
    });
  }

  async sendWithdrawalRejectedNotification(withdrawalData: WithdrawalEmailData): Promise<void> {
    const html = await compileTemplate('withdrawalRejected', withdrawalData);

    await this.sendEmail({
      to: withdrawalData.userEmail,
      subject: emailConfig.templates.withdrawalRejected.subject,
      html: html
    });
  }

  // Helper methods
  private async getAdminEmails(): Promise<string[]> {
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true }
      });
      return admins.map(admin => admin.email);
    } catch (error) {
      console.error('Failed to fetch admin emails:', error);
      return [emailConfig.defaults.replyTo]; // Fallback
    }
  }

  // Test email functionality
  async sendTestEmail(to: string): Promise<boolean> {
    const html = await compileTemplate('test', {
      recipient: to,
      timestamp: new Date().toISOString()
    });

    return await this.sendEmail({
      to,
      subject: 'Test Email - Pakistan Gaming Marketplace',
      html: html
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();