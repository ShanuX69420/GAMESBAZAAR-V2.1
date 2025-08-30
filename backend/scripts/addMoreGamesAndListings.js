const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const additionalGames = [
  {
    name: 'Call of Duty Mobile',
    slug: 'cod-mobile',
    imageUrl: 'https://picsum.photos/400/300?random=codm',
    platformTypes: ['Mobile'],
    categories: [
      { name: 'CP (COD Points)', slug: 'cp-cod-points', commissionRate: 8 },
      { name: 'Accounts', slug: 'accounts', commissionRate: 12 },
      { name: 'Weapon Skins', slug: 'weapon-skins', commissionRate: 10 }
    ]
  },
  {
    name: 'BGMI (Battlegrounds Mobile India)',
    slug: 'bgmi',
    imageUrl: 'https://picsum.photos/400/300?random=bgmi',
    platformTypes: ['Mobile'],
    categories: [
      { name: 'UC (Unknown Cash)', slug: 'uc', commissionRate: 5 },
      { name: 'Accounts', slug: 'accounts', commissionRate: 15 },
      { name: 'Royal Pass', slug: 'royal-pass', commissionRate: 8 }
    ]
  },
  {
    name: 'Free Fire',
    slug: 'free-fire',
    imageUrl: 'https://picsum.photos/400/300?random=ff',
    platformTypes: ['Mobile'],
    categories: [
      { name: 'Diamonds', slug: 'diamonds', commissionRate: 6 },
      { name: 'Elite Pass', slug: 'elite-pass', commissionRate: 10 },
      { name: 'Accounts', slug: 'accounts', commissionRate: 18 }
    ]
  },
  {
    name: 'League of Legends',
    slug: 'league-of-legends',
    imageUrl: 'https://picsum.photos/400/300?random=lol',
    platformTypes: ['PC'],
    categories: [
      { name: 'RP (Riot Points)', slug: 'rp', commissionRate: 7 },
      { name: 'Accounts', slug: 'accounts', commissionRate: 20 },
      { name: 'Champion Skins', slug: 'champion-skins', commissionRate: 12 }
    ]
  },
  {
    name: 'Fortnite',
    slug: 'fortnite',
    imageUrl: 'https://picsum.photos/400/300?random=fortnite',
    platformTypes: ['PC', 'Mobile', 'Console'],
    categories: [
      { name: 'V-Bucks', slug: 'v-bucks', commissionRate: 6 },
      { name: 'Accounts', slug: 'accounts', commissionRate: 25 },
      { name: 'Skins & Cosmetics', slug: 'skins-cosmetics', commissionRate: 15 }
    ]
  }
];

const moreSampleTitles = [
  'Legendary Skin Bundle',
  'Epic Weapon Collection',
  'Mythic Character Skin',
  'Battle Pass Premium',
  'Season Exclusive Items',
  'Limited Time Offer',
  'Rare Collectible Item',
  'Championship Series Skin',
  'Anniversary Special',
  'Pro Player Edition',
  'Tournament Winner Skin',
  'Exclusive Beta Access',
  'VIP Account Package',
  'Diamond Tier Rewards',
  'Master Rank Account',
  'Conqueror Title Account',
  'Max Level Character',
  'Full Unlock Package',
  'Premium Currency Pack',
  'Collector\'s Edition',
  'Ultimate Gaming Bundle',
  'Professional Setup',
  'Esports Team Skin',
  'Streamer Special Edition',
  'Content Creator Pack',
  'Influencer Collaboration',
  'Community Event Reward',
  'Developer Special Gift',
  'Alpha Tester Exclusive',
  'Founder\'s Pack Bonus'
];

const moreDescriptions = [
  'Extremely rare item with unique visual effects and animations.',
  'Professional-grade equipment used by top-tier players.',
  'Limited edition collectible from special gaming event.',
  'Exclusive content only available through this marketplace.',
  'High-value account with years of progression and unlocks.',
  'Premium gaming assets for serious collectors and players.',
  'Investment-grade digital items with proven market value.',
  'Tournament-quality gear used in competitive gaming.',
  'Authentic rare items verified by gaming community.',
  'Elite-tier content for discerning gamers and collectors.',
  'Legendary status symbols in the gaming community.',
  'Professionally maintained account with perfect statistics.',
  'Exclusive access to premium gaming content and features.',
  'Rare digital assets with historical gaming significance.',
  'Top-tier gaming equipment for competitive advantage.'
];

async function addMoreGamesAndListings() {
  try {
    console.log('🚀 Adding more games, categories, and listings...');

    // Get existing users
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' }
      }
    });

    console.log(`👥 Found ${users.length} users to use as sellers`);

    // Add new games and categories
    for (const gameData of additionalGames) {
      console.log(`🎮 Creating game: ${gameData.name}`);
      
      const game = await prisma.game.create({
        data: {
          name: gameData.name,
          slug: gameData.slug,
          imageUrl: gameData.imageUrl,
          platformTypes: gameData.platformTypes,
          orderIndex: Math.floor(Math.random() * 100),
          active: true
        }
      });

      // Add categories for this game
      for (const categoryData of gameData.categories) {
        console.log(`📂 Creating category: ${categoryData.name} for ${gameData.name}`);
        
        await prisma.category.create({
          data: {
            name: categoryData.name,
            slug: categoryData.slug,
            gameId: game.id,
            commissionRate: categoryData.commissionRate,
            fieldsConfig: {
              platform: { type: 'select', options: ['PC', 'Mobile', 'Console', 'Cross-Platform'], required: true },
              region: { type: 'select', options: ['Global', 'US', 'EU', 'Asia', 'Pakistan'], required: false },
              server: { type: 'select', options: ['Asia', 'Europe', 'NA', 'Global'], required: false },
              rank: { type: 'select', options: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Challenger'], required: false }
            },
            active: true
          }
        });
      }
    }

    // Now add many more listings
    const allGames = await prisma.game.findMany({
      include: {
        categories: true
      }
    });

    let totalListings = 0;
    const platforms = ['PC', 'Mobile', 'Console', 'Cross-Platform'];
    const regions = ['Global', 'US', 'EU', 'Asia', 'Pakistan'];
    const servers = ['Asia', 'Europe', 'NA', 'Global'];
    const ranks = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];

    for (const game of allGames) {
      for (const category of game.categories) {
        console.log(`📝 Adding 100+ listings for ${game.name} - ${category.name}`);

        // Add 80-150 listings per category
        const numListings = Math.floor(Math.random() * 71) + 80; // 80-150 listings

        for (let i = 0; i < numListings; i++) {
          const randomUser = users[Math.floor(Math.random() * users.length)];
          const randomTitle = moreSampleTitles[Math.floor(Math.random() * moreSampleTitles.length)];
          const randomDescription = moreDescriptions[Math.floor(Math.random() * moreDescriptions.length)];
          
          // Random price between 200-25000 PKR
          const price = Math.floor(Math.random() * 24800) + 200;
          
          // Random delivery type (70% instant for better testing)
          const deliveryType = Math.random() > 0.3 ? 'instant' : 'manual';
          
          // Random stock type
          const stockType = Math.random() > 0.6 ? 'unlimited' : 'limited';
          const quantity = stockType === 'unlimited' ? null : Math.floor(Math.random() * 50) + 1;

          // Enhanced custom fields
          const customFields = {
            platform: platforms[Math.floor(Math.random() * platforms.length)],
            region: regions[Math.floor(Math.random() * regions.length)],
          };

          // Add game-specific fields
          if (category.name.toLowerCase().includes('account')) {
            customFields.rank = ranks[Math.floor(Math.random() * ranks.length)];
            customFields.level = Math.floor(Math.random() * 100) + 1;
          } else if (category.name.toLowerCase().includes('skin') || category.name.toLowerCase().includes('cosmetic')) {
            customFields.rarity = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'][Math.floor(Math.random() * 5)];
            customFields.condition = ['New', 'Like New', 'Good', 'Fair'][Math.floor(Math.random() * 4)];
          }

          if (game.name.toLowerCase().includes('mobile') || game.name.toLowerCase().includes('pubg') || game.name.toLowerCase().includes('cod')) {
            customFields.server = servers[Math.floor(Math.random() * servers.length)];
          }

          // More listings with images (80% chance)
          const images = [];
          if (Math.random() > 0.2) {
            const numImages = Math.floor(Math.random() * 4) + 1; // 1-4 images
            for (let j = 0; j < numImages; j++) {
              images.push(`https://picsum.photos/400/300?random=${totalListings + i + j + 1000}`);
            }
          }

          try {
            await prisma.listing.create({
              data: {
                title: `${randomTitle} - ${game.name.split(' ')[0]} Edition`,
                description: `${randomDescription} Perfect for ${game.name} enthusiasts. Includes bonus content and exclusive features.`,
                price: price,
                deliveryType: deliveryType,
                stockType: stockType,
                quantity: quantity,
                images: images,
                customFields: customFields,
                deliveryContent: deliveryType === 'instant' ? 
                  `INSTANT DELIVERY:\nYour ${randomTitle} for ${game.name}\nCode: ${Math.random().toString(36).substr(2, 12).toUpperCase()}\nInstructions: Redeem in-game within 24 hours\nSupport: Message seller if any issues` : null,
                sellerId: randomUser.id,
                gameId: game.id,
                categoryId: category.id,
                active: true,
                hidden: false,
                boostedAt: Math.random() > 0.85 ? new Date() : null // 15% chance of being boosted
              }
            });

            totalListings++;

            if (totalListings % 200 === 0) {
              console.log(`✅ Added ${totalListings} listings so far...`);
            }
          } catch (error) {
            console.error(`❌ Error adding listing ${i + 1}:`, error.message);
          }
        }

        console.log(`✅ Completed ${game.name} - ${category.name}`);
      }
    }

    console.log(`🎉 Successfully added ${totalListings} MORE test listings!`);
    
    // Get final count
    const finalCount = await prisma.listing.count();
    console.log(`📊 Total listings in database: ${finalCount}`);

    // Show breakdown by game
    console.log('\n📊 Final Listing Count by Game:');
    for (const game of allGames) {
      const count = await prisma.listing.count({
        where: { gameId: game.id }
      });
      console.log(`  ${game.name}: ${count} listings`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addMoreGamesAndListings();