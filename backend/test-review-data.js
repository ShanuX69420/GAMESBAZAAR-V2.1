const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createTestData() {
  try {
    console.log('🌱 Creating test data for review system...')

    // Get existing users
    const users = await prisma.user.findMany()
    if (users.length < 2) {
      console.error('❌ Need at least 2 users to create test orders')
      return
    }

    const [buyer, seller] = users

    // Get existing game and category
    const game = await prisma.game.findFirst()
    const category = await prisma.category.findFirst()

    if (!game || !category) {
      console.error('❌ Need at least 1 game and category')
      return
    }

    // Create a test listing by the seller
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        gameId: game.id,
        categoryId: category.id,
        title: 'Premium Gaming Account - Ready for Reviews',
        price: 5000,
        description: 'High-level gaming account with all unlocks',
        deliveryType: 'manual',
        stockType: 'unlimited',
        quantity: null,
        active: true,
        hidden: false,
        customFields: {
          level: '100',
          region: 'Global'
        },
        images: []
      }
    })

    // Create a completed order
    const order = await prisma.order.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount: 5400, // 5000 + 8% commission
        commission: 400,
        status: 'COMPLETED',
        paymentMethod: 'manual'
      }
    })

    // Create system messages for the order
    await prisma.message.createMany({
      data: [
        {
          orderId: order.id,
          senderId: seller.id,
          receiverId: buyer.id,
          content: 'Order marked as PAID by seller. Awaiting delivery.',
          type: 'system',
          isAutomatedDelivery: false
        },
        {
          orderId: order.id,
          senderId: seller.id,
          receiverId: buyer.id,
          content: 'Your gaming account details have been delivered! Please check and confirm receipt.',
          type: 'delivery',
          isAutomatedDelivery: false
        },
        {
          orderId: order.id,
          senderId: buyer.id,
          receiverId: seller.id,
          content: 'Order completed! Payment of PKR 5000 has been released to seller.',
          type: 'completion',
          isAutomatedDelivery: false
        }
      ]
    })

    console.log('✅ Test data created successfully!')
    console.log(`📋 Order ID: ${order.id}`)
    console.log(`👤 Buyer: ${buyer.username} (${buyer.email})`)
    console.log(`👤 Seller: ${seller.username} (${seller.email})`)
    console.log(`🎮 Listing: ${listing.title}`)
    console.log(`💰 Amount: PKR ${order.amount}`)
    console.log('')
    console.log('🎯 To test the review system:')
    console.log(`1. Login as buyer (${buyer.email})`)
    console.log(`2. Go to orders and find order #${order.id.slice(0, 8)}`)
    console.log('3. You should see the review section for the completed order')

  } catch (error) {
    console.error('❌ Error creating test data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestData()