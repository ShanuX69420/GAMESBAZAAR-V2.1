const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🚀 Creating test buyer and seller accounts with order data...');

    // Create test users
    const passwordHash = await bcrypt.hash('password123', 12);

    // Create buyer account
    const buyer = await prisma.user.upsert({
      where: { email: 'buyer@test.com' },
      update: {},
      create: {
        username: 'testbuyer',
        email: 'buyer@test.com',
        passwordHash,
        role: 'user',
        verified: false,
        balance: 10000 // PKR 10,000 for testing
      }
    });

    // Create seller account
    const seller = await prisma.user.upsert({
      where: { email: 'seller@test.com' },
      update: {},
      create: {
        username: 'testseller',
        email: 'seller@test.com',
        passwordHash,
        role: 'user',
        verified: true, // Verified seller for instant fund release
        balance: 5000
      }
    });

    console.log('✅ Created test accounts:');
    console.log('   Buyer: testbuyer (buyer@test.com / password123)');
    console.log('   Seller: testseller (seller@test.com / password123)');

    // Get or create test game and category
    let game = await prisma.game.findFirst({
      where: { slug: 'valorant' }
    });

    if (!game) {
      game = await prisma.game.create({
        data: {
          name: 'Valorant',
          slug: 'valorant',
          imageUrl: 'https://res.cloudinary.com/dggn4yphc/image/upload/v1735561800/valorant.jpg',
          platformTypes: ['PC'],
          orderIndex: 1,
          active: true
        }
      });
    }

    let category = await prisma.category.findFirst({
      where: { 
        gameId: game.id,
        slug: 'weapon-skins' 
      }
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          gameId: game.id,
          name: 'Weapon Skins',
          slug: 'weapon-skins',
          commissionRate: 8.0,
          fieldsConfig: {
            skin_type: { type: 'select', options: ['Rifle', 'Pistol', 'SMG', 'Sniper'], required: true },
            rarity: { type: 'select', options: ['Select', 'Deluxe', 'Premium', 'Ultra', 'Exclusive'], required: true }
          },
          active: true
        }
      });
    }

    // Create test listings from seller
    const listings = [
      {
        title: 'Valorant Phantom Oni Skin',
        price: 2500,
        description: 'Rare Phantom skin with custom animations. Account comes with full access.',
        deliveryType: 'manual',
        stockType: 'limited',
        quantity: 3,
        images: ['https://res.cloudinary.com/dggn4yphc/image/upload/v1735561900/phantom-oni.jpg'],
        customFields: {
          skin_type: 'Rifle',
          rarity: 'Premium'
        }
      },
      {
        title: 'Valorant Vandal Reaver Collection',
        price: 3200,
        description: 'Complete Reaver collection including Vandal, Sheriff, and Knife. Premium account.',
        deliveryType: 'manual',
        stockType: 'limited',
        quantity: 2,
        images: ['https://res.cloudinary.com/dggn4yphc/image/upload/v1735561900/vandal-reaver.jpg'],
        customFields: {
          skin_type: 'Rifle',
          rarity: 'Exclusive'
        }
      },
      {
        title: 'Valorant Dragon Collection Bundle',
        price: 4500,
        description: 'Ultra rare Dragon collection with Operator, Vandal, and melee weapons.',
        deliveryType: 'instant',
        stockType: 'unlimited',
        quantity: null,
        images: ['https://res.cloudinary.com/dggn4yphc/image/upload/v1735561900/dragon-bundle.jpg'],
        customFields: {
          skin_type: 'Sniper',
          rarity: 'Ultra'
        }
      }
    ];

    // Delete existing listings from test seller to avoid duplicates
    await prisma.listing.deleteMany({
      where: { sellerId: seller.id }
    });

    const createdListings = [];
    for (const listingData of listings) {
      const listing = await prisma.listing.create({
        data: {
          ...listingData,
          sellerId: seller.id,
          gameId: game.id,
          categoryId: category.id,
          active: true,
          hidden: false
        }
      });
      createdListings.push(listing);
    }

    console.log(`✅ Created ${createdListings.length} test listings for seller`);

    // Create sample orders in different states
    await prisma.order.deleteMany({
      where: {
        OR: [
          { buyerId: buyer.id },
          { sellerId: seller.id }
        ]
      }
    });

    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: buyer.id },
          { senderId: seller.id }
        ]
      }
    });

    // Order 1: PENDING (just created)
    const order1 = await prisma.order.create({
      data: {
        listingId: createdListings[0].id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount: 2500 + (2500 * 0.08), // Price + 8% commission
        commission: 2500 * 0.08,
        status: 'PENDING',
        paymentMethod: null
      }
    });

    // Order 2: PAID (payment confirmed)
    const order2 = await prisma.order.create({
      data: {
        listingId: createdListings[1].id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount: 3200 + (3200 * 0.08),
        commission: 3200 * 0.08,
        status: 'PAID',
        paymentMethod: 'manual'
      }
    });

    // Order 3: DELIVERED (awaiting buyer confirmation)
    const order3 = await prisma.order.create({
      data: {
        listingId: createdListings[2].id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount: 4500 + (4500 * 0.08),
        commission: 4500 * 0.08,
        status: 'DELIVERED',
        paymentMethod: 'manual'
      }
    });

    // Add some system messages to orders
    await prisma.message.create({
      data: {
        orderId: order2.id,
        senderId: seller.id,
        receiverId: buyer.id,
        content: 'Order marked as PAID by seller. Awaiting delivery.',
        type: 'system',
        isAutomatedDelivery: false
      }
    });

    await prisma.message.create({
      data: {
        orderId: order3.id,
        senderId: seller.id,
        receiverId: buyer.id,
        content: 'Order has been delivered! Account details sent. Please confirm receipt to complete the transaction.',
        type: 'delivery',
        isAutomatedDelivery: false
      }
    });

    console.log('✅ Created test orders:');
    console.log(`   Order 1 (PENDING): ${order1.id.slice(0, 8)} - PKR ${order1.amount}`);
    console.log(`   Order 2 (PAID): ${order2.id.slice(0, 8)} - PKR ${order2.amount}`);
    console.log(`   Order 3 (DELIVERED): ${order3.id.slice(0, 8)} - PKR ${order3.amount}`);

    console.log('\n🎯 TESTING INSTRUCTIONS:');
    console.log('1. Login as BUYER: testbuyer / buyer@test.com / password123');
    console.log('2. Login as SELLER: testseller / seller@test.com / password123');
    console.log('3. Go to /games/valorant/weapon-skins to see listings');
    console.log('4. Orders are available at /orders/[order-id] for testing');
    console.log('\n📋 TEST SCENARIOS:');
    console.log('- Seller can mark Order 1 as PAID');
    console.log('- Seller can mark Order 2 as DELIVERED');  
    console.log('- Buyer can complete Order 3 or dispute it');
    console.log('- Both parties can open disputes on any active order');

    console.log('\n🚀 Ready for testing!');

  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();