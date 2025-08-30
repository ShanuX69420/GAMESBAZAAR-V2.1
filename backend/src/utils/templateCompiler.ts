import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

// Template cache to avoid reading files multiple times
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

// Template directory path
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'email');

// Ensure templates directory exists
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

// Helper functions for templates
handlebars.registerHelper('formatCurrency', function(amount: number) {
  return `PKR ${amount.toLocaleString()}`;
});

handlebars.registerHelper('formatDate', function(date: Date) {
  return new Date(date).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

handlebars.registerHelper('eq', function(a: any, b: any) {
  return a === b;
});

handlebars.registerHelper('ne', function(a: any, b: any) {
  return a !== b;
});

// Compile template function
export async function compileTemplate(templateName: string, data: any): Promise<string> {
  try {
    // Check if template is already cached
    if (templateCache.has(templateName)) {
      const template = templateCache.get(templateName)!;
      return template(data);
    }

    // Read template file
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
    
    if (!fs.existsSync(templatePath)) {
      console.warn(`Template not found: ${templateName}, using default template`);
      return getDefaultTemplate(templateName, data);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Compile template
    const template = handlebars.compile(templateContent);
    
    // Cache compiled template
    templateCache.set(templateName, template);
    
    // Return compiled HTML
    return template(data);
    
  } catch (error) {
    console.error(`Error compiling template ${templateName}:`, error);
    return getDefaultTemplate(templateName, data);
  }
}

// Default template fallback when template files don't exist
function getDefaultTemplate(templateName: string, data: any): string {
  const baseStyle = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .email-container { max-width: 600px; margin: 0 auto; background: #fff; }
      .header { background: #10b981; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; }
      .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
      .button { display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
      .amount { font-weight: bold; color: #10b981; }
      .order-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
  `;

  switch (templateName) {
    case 'orderCreated':
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🎮 Pakistan Gaming Marketplace</h1>
          </div>
          <div class="content">
            <h2>Order ${data.recipientRole === 'buyer' ? 'Created' : 'Received'}</h2>
            <div class="order-details">
              <p><strong>Order ID:</strong> ${data.orderId}</p>
              <p><strong>Item:</strong> ${data.listingTitle}</p>
              <p><strong>Amount:</strong> <span class="amount">PKR ${data.amount.toLocaleString()}</span></p>
              <p><strong>Service Fee:</strong> PKR ${data.commission.toLocaleString()}</p>
              <p><strong>Total:</strong> <span class="amount">PKR ${data.total.toLocaleString()}</span></p>
            </div>
            ${data.recipientRole === 'buyer' 
              ? '<p>Please proceed with payment to complete your order. The seller will deliver your item once payment is confirmed.</p>' 
              : '<p>A new order has been placed for your item. You will be notified once the buyer completes payment.</p>'
            }
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Your trusted gaming marketplace</p>
          </div>
        </div>
      `;

    case 'orderPaid':
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🎮 Pakistan Gaming Marketplace</h1>
          </div>
          <div class="content">
            <h2>Payment Confirmed</h2>
            <div class="order-details">
              <p><strong>Order ID:</strong> ${data.orderId}</p>
              <p><strong>Item:</strong> ${data.listingTitle}</p>
              <p><strong>Amount Paid:</strong> <span class="amount">PKR ${data.total.toLocaleString()}</span></p>
            </div>
            ${data.recipientRole === 'buyer' 
              ? '<p>Your payment has been confirmed. The seller will now deliver your item. You will be notified once delivery is complete.</p>' 
              : '<p>Payment has been received for your order. Please deliver the item to the buyer as soon as possible.</p>'
            }
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Your trusted gaming marketplace</p>
          </div>
        </div>
      `;

    case 'orderDelivered':
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🎮 Pakistan Gaming Marketplace</h1>
          </div>
          <div class="content">
            <h2>Item Delivered</h2>
            <div class="order-details">
              <p><strong>Order ID:</strong> ${data.orderId}</p>
              <p><strong>Item:</strong> ${data.listingTitle}</p>
              ${data.deliveryMessage ? `<p><strong>Delivery Message:</strong> ${data.deliveryMessage}</p>` : ''}
            </div>
            ${data.recipientRole === 'buyer' 
              ? '<p>Your item has been delivered! Please check your messages for delivery details and confirm receipt to complete the order.</p>' 
              : '<p>You have marked this order as delivered. The buyer will now confirm receipt to complete the transaction.</p>'
            }
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Your trusted gaming marketplace</p>
          </div>
        </div>
      `;

    case 'orderCompleted':
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🎮 Pakistan Gaming Marketplace</h1>
          </div>
          <div class="content">
            <h2>Order Completed</h2>
            <div class="order-details">
              <p><strong>Order ID:</strong> ${data.orderId}</p>
              <p><strong>Item:</strong> ${data.listingTitle}</p>
              <p><strong>Amount:</strong> <span class="amount">PKR ${data.amount.toLocaleString()}</span></p>
            </div>
            ${data.recipientRole === 'buyer' 
              ? '<p>Thank you for your purchase! Your order has been completed successfully. Don\'t forget to leave a review for the seller.</p>' 
              : '<p>Congratulations! Your order has been completed and payment has been released to your account.</p>'
            }
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Your trusted gaming marketplace</p>
          </div>
        </div>
      `;

    case 'orderDisputed':
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🎮 Pakistan Gaming Marketplace</h1>
          </div>
          <div class="content">
            <h2>Order Dispute Filed</h2>
            <div class="order-details">
              <p><strong>Order ID:</strong> ${data.orderId}</p>
              <p><strong>Item:</strong> ${data.listingTitle}</p>
              ${data.disputeReason ? `<p><strong>Dispute Reason:</strong> ${data.disputeReason}</p>` : ''}
            </div>
            ${data.recipientRole === 'admin' 
              ? '<p>A dispute has been filed and requires admin attention. Please review the order and messages to resolve the issue.</p>'
              : '<p>A dispute has been filed for this order. Our support team will review the case and contact you if needed.</p>'
            }
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Your trusted gaming marketplace</p>
          </div>
        </div>
      `;

    case 'welcome':
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🎮 Welcome to Pakistan Gaming Marketplace!</h1>
          </div>
          <div class="content">
            <h2>Welcome aboard, ${data.username}!</h2>
            <p>Thank you for joining Pakistan Gaming Marketplace, your trusted platform for buying and selling digital gaming assets.</p>
            <h3>What you can do:</h3>
            <ul>
              <li>🛒 Buy gaming accounts, keys, and services from verified sellers</li>
              <li>💰 Sell your own gaming assets to Pakistani gamers</li>
              <li>💬 Chat directly with buyers and sellers</li>
              <li>🔒 Enjoy secure escrow protection on all transactions</li>
            </ul>
            <p>Ready to start? Visit our marketplace and explore thousands of gaming items!</p>
            <a href="https://pmv2.com" class="button">Explore Marketplace</a>
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Your trusted gaming marketplace</p>
          </div>
        </div>
      `;

    case 'test':
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🧪 Test Email</h1>
          </div>
          <div class="content">
            <h2>Email System Test</h2>
            <p>This is a test email from Pakistan Gaming Marketplace.</p>
            <p><strong>Recipient:</strong> ${data.recipient}</p>
            <p><strong>Timestamp:</strong> ${data.timestamp}</p>
            <p>If you're seeing this email, the notification system is working correctly!</p>
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Email System Test</p>
          </div>
        </div>
      `;

    default:
      return `
        ${baseStyle}
        <div class="email-container">
          <div class="header">
            <h1>🎮 Pakistan Gaming Marketplace</h1>
          </div>
          <div class="content">
            <h2>Notification</h2>
            <p>You have a new notification from Pakistan Gaming Marketplace.</p>
            <p>Please visit your account for more details.</p>
          </div>
          <div class="footer">
            <p>Pakistan Gaming Marketplace - Your trusted gaming marketplace</p>
          </div>
        </div>
      `;
  }
}