import crypto from 'crypto'
import { jazzCashConfig } from '../config/jazzcash'

export interface JazzCashTransactionData {
  orderId: string
  amount: number
  buyerEmail: string
  buyerPhone?: string
  description: string
}

export interface JazzCashTransactionResponse {
  success: boolean
  transactionId?: string
  redirectUrl?: string
  error?: string
  rawResponse?: any
}

export class JazzCashService {
  private generateSecureHash(data: Record<string, any>): string {
    // Sort parameters alphabetically and create hash string
    const sortedKeys = Object.keys(data).sort()
    let hashString = jazzCashConfig.integritySalt + '&'
    
    sortedKeys.forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        hashString += `${data[key]}&`
      }
    })
    
    // Remove trailing &
    hashString = hashString.slice(0, -1)
    
    // Generate SHA256 hash
    return crypto.createHash('sha256').update(hashString).digest('hex').toUpperCase()
  }

  private generateTransactionId(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    return `JC${timestamp}${random}`
  }

  private formatAmount(amount: number): string {
    // JazzCash expects amount in paisa (1 PKR = 100 paisa)
    return Math.round(amount * 100).toString()
  }

  async initiateTransaction(data: JazzCashTransactionData): Promise<JazzCashTransactionResponse> {
    try {
      const transactionId = this.generateTransactionId()
      const formattedAmount = this.formatAmount(data.amount)
      const expiryDateTime = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      const formattedExpiry = expiryDateTime.toISOString().replace(/[-:T]/g, '').substring(0, 14)
      
      const transactionData = {
        pp_Version: '1.1',
        pp_TxnType: 'MWALLET', // Mobile Wallet
        pp_Language: 'EN',
        pp_MerchantID: jazzCashConfig.merchantId,
        pp_SubMerchantID: '',
        pp_Password: jazzCashConfig.password,
        pp_BankID: 'TBANK',
        pp_ProductID: 'RETL',
        pp_TxnRefNo: transactionId,
        pp_Amount: formattedAmount,
        pp_TxnCurrency: 'PKR',
        pp_TxnDateTime: new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14),
        pp_BillReference: data.orderId,
        pp_Description: data.description.substring(0, 100), // Max 100 characters
        pp_TxnExpiryDateTime: formattedExpiry,
        pp_ReturnURL: jazzCashConfig.returnUrl,
        pp_SecureHash: '', // Will be calculated
        ppmpf_1: '1', // Mobile Number flag
        ppmpf_2: '2', // Email flag
        ppmpf_3: '3', // Date of Birth flag
        ppmpf_4: '4', // CNIC flag
        ppmpf_5: '5'  // Discount amount flag
      }

      // Calculate secure hash
      transactionData.pp_SecureHash = this.generateSecureHash(transactionData)

      // In a real implementation, you would make an HTTP request to JazzCash API
      // For now, we'll simulate the response
      if (jazzCashConfig.isProduction) {
        // Make actual API call in production
        const response = await fetch(jazzCashConfig.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData)
        })
        
        const result = await response.json() as any
        return {
          success: response.ok,
          transactionId: transactionId,
          redirectUrl: result.redirectUrl,
          rawResponse: result
        }
      } else {
        // Development mode - simulate successful response
        return {
          success: true,
          transactionId: transactionId,
          redirectUrl: `${jazzCashConfig.apiUrl}?transactionId=${transactionId}&orderId=${data.orderId}`,
          rawResponse: { status: 'INITIATED', message: 'Transaction initiated successfully' }
        }
      }
    } catch (error) {
      console.error('JazzCash transaction error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      }
    }
  }

  async verifyTransaction(transactionId: string, secureHash: string): Promise<boolean> {
    try {
      // In production, verify the transaction with JazzCash API
      if (jazzCashConfig.isProduction) {
        // Make verification API call
        const response = await fetch(`${jazzCashConfig.apiUrl}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionId,
            merchantId: jazzCashConfig.merchantId,
            password: jazzCashConfig.password
          })
        })
        
        const result = await response.json() as any
        return result.status === 'SUCCESS'
      } else {
        // Development mode - always return true for testing
        console.log(`[DEV] JazzCash transaction verification: ${transactionId} - SUCCESS`)
        return true
      }
    } catch (error) {
      console.error('JazzCash verification error:', error)
      return false
    }
  }

  generatePaymentForm(data: JazzCashTransactionData): string {
    // Generate HTML form for JazzCash payment
    const transactionId = this.generateTransactionId()
    const formattedAmount = this.formatAmount(data.amount)
    const expiryDateTime = new Date(Date.now() + 30 * 60 * 1000)
    const formattedExpiry = expiryDateTime.toISOString().replace(/[-:T]/g, '').substring(0, 14)
    
    const transactionData = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: jazzCashConfig.merchantId,
      pp_SubMerchantID: '',
      pp_Password: jazzCashConfig.password,
      pp_BankID: 'TBANK',
      pp_ProductID: 'RETL',
      pp_TxnRefNo: transactionId,
      pp_Amount: formattedAmount,
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14),
      pp_BillReference: data.orderId,
      pp_Description: data.description.substring(0, 100),
      pp_TxnExpiryDateTime: formattedExpiry,
      pp_ReturnURL: jazzCashConfig.returnUrl,
      pp_SecureHash: ''
    }

    transactionData.pp_SecureHash = this.generateSecureHash(transactionData)

    let formHTML = `
      <form id="jazzcash-form" method="post" action="${jazzCashConfig.apiUrl}">
    `
    
    Object.entries(transactionData).forEach(([key, value]) => {
      formHTML += `<input type="hidden" name="${key}" value="${value}" />\n`
    })
    
    formHTML += `
        <input type="submit" value="Pay with JazzCash" />
      </form>
      <script>
        // Auto-submit form
        document.getElementById('jazzcash-form').submit();
      </script>
    `
    
    return formHTML
  }
}