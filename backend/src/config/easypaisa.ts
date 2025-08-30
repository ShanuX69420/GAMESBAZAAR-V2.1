export const easypaisaConfig = {
  storeId: process.env.EASYPAISA_STORE_ID || 'TEST123',
  accountNum: process.env.EASYPAISA_ACCOUNT_NUM || '1234567890',
  hashKey: process.env.EASYPAISA_HASH_KEY || 'test_hash_key',
  apiUrl: process.env.EASYPAISA_API_URL || 'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
  callbackUrl: process.env.EASYPAISA_CALLBACK_URL || 'http://localhost:3000/payment/easypaisa/callback',
  // Test credentials for development
  isProduction: process.env.NODE_ENV === 'production'
}