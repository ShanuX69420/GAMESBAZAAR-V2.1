import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pmv2.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@pmv2.com',
      passwordHash: adminPassword,
      role: 'admin',
      verified: true,
      balance: 0
    }
  })

  // Create test user
  const userPassword = await bcrypt.hash('user123', 12)
  const testUser = await prisma.user.upsert({
    where: { email: 'testuser@pmv2.com' },
    update: {},
    create: {
      username: 'testuser',
      email: 'testuser@pmv2.com',
      passwordHash: userPassword,
      role: 'user',
      verified: false,
      balance: 1000
    }
  })

  // Create popular games
  const games = [
    {
      name: 'PUBG Mobile',
      slug: 'pubg-mobile',
      platformTypes: ['Mobile'],
      orderIndex: 1
    },
    {
      name: 'Free Fire',
      slug: 'free-fire',
      platformTypes: ['Mobile'],
      orderIndex: 2
    },
    {
      name: 'FIFA 24',
      slug: 'fifa-24',
      platformTypes: ['PC', 'Console'],
      orderIndex: 3
    },
    {
      name: 'Call of Duty',
      slug: 'call-of-duty',
      platformTypes: ['PC', 'Console', 'Mobile'],
      orderIndex: 4
    }
  ]

  for (const gameData of games) {
    await prisma.game.upsert({
      where: { slug: gameData.slug },
      update: {},
      create: gameData
    })
  }

  // Create categories for PUBG Mobile
  const pubgGame = await prisma.game.findUnique({ where: { slug: 'pubg-mobile' } })
  if (pubgGame) {
    const categories = [
      {
        gameId: pubgGame.id,
        name: 'Accounts',
        slug: 'accounts',
        commissionRate: 10,
        fieldsConfig: {
          required: ['platform', 'region', 'level'],
          optional: ['skins', 'weapons']
        }
      },
      {
        gameId: pubgGame.id,
        name: 'UC (Unknown Cash)',
        slug: 'uc',
        commissionRate: 5,
        fieldsConfig: {
          required: ['amount', 'region'],
          optional: ['delivery_method']
        }
      }
    ]

    for (const categoryData of categories) {
      await prisma.category.upsert({
        where: { gameId_slug: { gameId: categoryData.gameId, slug: categoryData.slug } },
        update: {},
        create: categoryData
      })
    }
  }

  console.log('✅ Database seeded successfully!')
  console.log(`👤 Admin user: admin@pmv2.com (password: admin123)`)
  console.log(`👤 Test user: testuser@pmv2.com (password: user123)`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })