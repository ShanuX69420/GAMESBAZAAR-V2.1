export const jazzCashConfig = {
  merchantId: process.env.JAZZCASH_MERCHANT_ID || 'MC123456',
  password: process.env.JAZZCASH_PASSWORD || 'test123',
  integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || 'salt123',
  returnUrl: process.env.JAZZCASH_RETURN_URL || 'http://localhost:3000/payment/callback',
  apiUrl: process.env.JAZZCASH_API_URL || 'https://payments.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction',
  // Test credentials for development
  isProduction: process.env.NODE_ENV === 'production'
}