import crypto from 'crypto'
import { easypaisaConfig } from '../config/easypaisa'

export interface EasypaisaTransactionData {
  orderId: string
  amount: number
  buyerEmail: string
  buyerPhone?: string
  description: string
}

export interface EasypaisaTransactionResponse {
  success: boolean
  transactionId?: string
  redirectUrl?: string
  error?: string
  rawResponse?: any
}

export class EasypaisaService {
  private generateHash(data: string): string {
    // Generate SHA256 hash with Easypaisa hash key
    const hashString = data + easypaisaConfig.hashKey
    return crypto.createHash('sha256').update(hashString).digest('hex').toUpperCase()
  }

  private generateTransactionId(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    return `EP${timestamp}${random}`
  }

  private formatAmount(amount: number): string {
    // Easypaisa expects amount with 2 decimal places
    return amount.toFixed(2)
  }

  async initiateTransaction(data: EasypaisaTransactionData): Promise<EasypaisaTransactionResponse> {
    try {
      const transactionId = this.generateTransactionId()
      const formattedAmount = this.formatAmount(data.amount)
      const expiryTime = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      
      // Build hash string for Easypaisa
      const hashString = `${easypaisaConfig.accountNum}${formattedAmount}${transactionId}${data.description}`
      const hash = this.generateHash(hashString)
      
      const transactionData = {
        storeId: easypaisaConfig.storeId,
        accountNum: easypaisaConfig.accountNum,
        transactionAmount: formattedAmount,
        transactionType: 'MA',
        tokenExpiry: Math.floor(expiryTime.getTime() / 1000), // Unix timestamp
        billReference: data.orderId,
        description: data.description.substring(0, 100), // Max 100 characters
        transactionId: transactionId,
        emailAddress: data.buyerEmail,
        mobileNum: data.buyerPhone || '03000000000',
        hashValue: hash,
        postBackURL: easypaisaConfig.callbackUrl
      }

      // In a real implementation, you would make an HTTP request to Easypaisa API
      // For now, we'll simulate the response
      if (easypaisaConfig.isProduction) {
        // Make actual API call in production
        const response = await fetch(easypaisaConfig.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(transactionData as any).toString()
        })
        
        const result = await response.text()
        
        return {
          success: response.ok,
          transactionId: transactionId,
          redirectUrl: `${easypaisaConfig.apiUrl}?transactionId=${transactionId}`,
          rawResponse: result
        }
      } else {
        // Development mode - simulate successful response
        return {
          success: true,
          transactionId: transactionId,
          redirectUrl: `${easypaisaConfig.apiUrl}?transactionId=${transactionId}&orderId=${data.orderId}`,
          rawResponse: { status: 'INITIATED', message: 'Transaction initiated successfully' }
        }
      }
    } catch (error) {
      console.error('Easypaisa transaction error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      }
    }
  }

  async verifyTransaction(transactionId: string, hash: string): Promise<boolean> {
    try {
      // In production, verify the transaction with Easypaisa API
      if (easypaisaConfig.isProduction) {
        // Make verification API call
        const verificationData = {
          storeId: easypaisaConfig.storeId,
          accountNum: easypaisaConfig.accountNum,
          transactionId: transactionId,
          hashValue: hash
        }
        
        const response = await fetch(`${easypaisaConfig.apiUrl}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(verificationData as any).toString()
        })
        
        const result = await response.text()
        return result.includes('SUCCESS') || result.includes('PAID')
      } else {
        // Development mode - always return true for testing
        console.log(`[DEV] Easypaisa transaction verification: ${transactionId} - SUCCESS`)
        return true
      }
    } catch (error) {
      console.error('Easypaisa verification error:', error)
      return false
    }
  }

  generatePaymentForm(data: EasypaisaTransactionData): string {
    // Generate HTML form for Easypaisa payment
    const transactionId = this.generateTransactionId()
    const formattedAmount = this.formatAmount(data.amount)
    const expiryTime = new Date(Date.now() + 30 * 60 * 1000)
    
    const hashString = `${easypaisaConfig.accountNum}${formattedAmount}${transactionId}${data.description}`
    const hash = this.generateHash(hashString)
    
    const transactionData = {
      storeId: easypaisaConfig.storeId,
      accountNum: easypaisaConfig.accountNum,
      transactionAmount: formattedAmount,
      transactionType: 'MA',
      tokenExpiry: Math.floor(expiryTime.getTime() / 1000),
      billReference: data.orderId,
      description: data.description.substring(0, 100),
      transactionId: transactionId,
      emailAddress: data.buyerEmail,
      mobileNum: data.buyerPhone || '03000000000',
      hashValue: hash,
      postBackURL: easypaisaConfig.callbackUrl
    }

    let formHTML = `
      <form id="easypaisa-form" method="post" action="${easypaisaConfig.apiUrl}">
    `
    
    Object.entries(transactionData).forEach(([key, value]) => {
      formHTML += `<input type="hidden" name="${key}" value="${value}" />\n`
    })
    
    formHTML += `
        <input type="submit" value="Pay with Easypaisa" />
      </form>
      <script>
        // Auto-submit form
        document.getElementById('easypaisa-form').submit();
      </script>
    `
    
    return formHTML
  }

  generateQRPayment(data: EasypaisaTransactionData): string {
    // Generate QR code data for Easypaisa mobile app payment
    const transactionId = this.generateTransactionId()
    const formattedAmount = this.formatAmount(data.amount)
    
    const qrData = {
      storeId: easypaisaConfig.storeId,
      accountNum: easypaisaConfig.accountNum,
      amount: formattedAmount,
      transactionId: transactionId,
      orderId: data.orderId,
      description: data.description
    }
    
    // Return QR code data as JSON string
    return JSON.stringify(qrData)
  }
}