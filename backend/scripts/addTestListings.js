const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sampleTitles = [
  'Phantom Skin Collection',
  'Vandal Prime Skin',
  'Operator Dragon Lore',
  'Knife Karambit Fade',
  'AK-47 Redline Skin',
  'AWP Asiimov Skin',
  'M4A4 Howl Skin',
  'Butterfly Knife Tiger Tooth',
  'Glock Water Elemental',
  'Desert Eagle Blaze',
  'P90 Asiimov Skin',
  'UMP-45 Primal Saber',
  'StatTrak™ AK-47',
  'Souvenir AWP Pink DDPAT',
  'M9 Bayonet Doppler',
  'Huntsman Knife Slaughter',
  'Falchion Knife Case Hardened',
  'Bowie Knife Crimson Web',
  'Shadow Daggers Fade',
  'Talon Knife Autotronic',
  'Ursus Knife Marble Fade',
  'Stiletto Knife Tiger Tooth',
  'Navaja Knife Doppler',
  'Paracord Knife Vanilla',
  'Survival Knife Forest DDPAT',
  'Classic Knife Night Stripe',
  'Nomad Knife Blue Steel',
  'Skeleton Knife Scorched',
  'Flip Knife Gamma Doppler',
  'Gut Knife Freehand',
  'Bayonet Lore',
  'Karambit Autotronic',
  'M4A1-S Master Piece',
  'FAMAS Djinn Skin',
  'Galil AR Cerberus',
  'SCAR-20 Cardiac',
  'SSG 08 Blood in Water',
  'G3SG1 Flux Skin',
  'XM1014 Tranquility',
  'MAG-7 Praetorian',
  'Nova Antique',
  'Sawed-Off The Kraken',
  'Negev Mjölnir',
  'M249 Aztec',
  'MP9 Bulldozer',
  'MAC-10 Neon Rider',
  'PP-Bizon Judgment',
  'P90 Death by Kitty',
  'UMP-45 Momentum',
  'MP5-SD Phosphor'
];

const sampleDescriptions = [
  'Rare skin with unique pattern and design. Perfect condition with minimal wear.',
  'Premium quality weapon skin with vibrant colors and excellent details.',
  'Limited edition skin from special collection. Very rare and valuable.',
  'Beautiful design with intricate artwork. Well-maintained condition.',
  'Popular skin among collectors. Good investment potential.',
  'Classic design with timeless appeal. Excellent for gameplay.',
  'High-demand skin with stunning visual effects.',
  'Exclusive skin with special animations and effects.',
  'Collector\'s item with unique pattern variations.',
  'Professional-grade skin suitable for competitive play.',
  'Artistic masterpiece with detailed craftsmanship.',
  'Legendary skin with historical significance.',
  'Modern design with futuristic aesthetics.',
  'Vintage skin from early collection series.',
  'Tournament-grade skin used by professionals.',
  'Custom design with personal touch and style.',
  'Factory new condition with pristine appearance.',
  'Battle-tested skin with authentic wear patterns.',
  'Souvenir edition with special tournament stickers.',
  'StatTrak™ technology included for kill tracking.'
];

const platforms = ['PC', 'Mobile', 'Console', 'Cross-Platform'];
const regions = ['Global', 'US', 'EU', 'Asia', 'Pakistan'];

async function addTestListings() {
  try {
    console.log('🚀 Starting to add test listings...');

    // Get existing users (sellers)
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' }
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found. Please create some users first.');
      return;
    }

    console.log(`👥 Found ${users.length} users to use as sellers`);

    // Get existing games and categories
    const games = await prisma.game.findMany({
      include: {
        categories: true
      }
    });

    console.log(`🎮 Found ${games.length} games`);

    let totalListings = 0;

    for (const game of games) {
      for (const category of game.categories) {
        console.log(`📝 Adding listings for ${game.name} - ${category.name}`);

        // Add 50-100 listings per category
        const numListings = Math.floor(Math.random() * 51) + 50; // 50-100 listings

        for (let i = 0; i < numListings; i++) {
          const randomUser = users[Math.floor(Math.random() * users.length)];
          const randomTitle = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
          const randomDescription = sampleDescriptions[Math.floor(Math.random() * sampleDescriptions.length)];
          
          // Random price between 500-15000 PKR
          const price = Math.floor(Math.random() * 14500) + 500;
          
          // Random delivery type
          const deliveryType = Math.random() > 0.3 ? 'instant' : 'manual';
          
          // Random stock type
          const stockType = Math.random() > 0.7 ? 'unlimited' : 'limited';
          const quantity = stockType === 'unlimited' ? null : Math.floor(Math.random() * 20) + 1;

          // Random custom fields based on game
          let customFields = {};
          if (game.name.toLowerCase().includes('valorant') || game.name.toLowerCase().includes('cs')) {
            customFields = {
              platform: platforms[Math.floor(Math.random() * platforms.length)],
              region: regions[Math.floor(Math.random() * regions.length)],
              condition: ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn'][Math.floor(Math.random() * 4)]
            };
          } else if (game.name.toLowerCase().includes('pubg') || game.name.toLowerCase().includes('cod')) {
            customFields = {
              platform: platforms[Math.floor(Math.random() * platforms.length)],
              server: ['Global', 'Asia', 'Europe', 'NA'][Math.floor(Math.random() * 4)]
            };
          }

          // Some listings with images
          const images = [];
          if (Math.random() > 0.5) {
            // Add 1-3 random placeholder images
            const numImages = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < numImages; j++) {
              images.push(`https://picsum.photos/400/300?random=${totalListings + i + j}`);
            }
          }

          try {
            await prisma.listing.create({
              data: {
                title: `${randomTitle} #${i + 1}`,
                description: randomDescription,
                price: price,
                deliveryType: deliveryType,
                stockType: stockType,
                quantity: quantity,
                images: images,
                customFields: customFields,
                deliveryContent: deliveryType === 'instant' ? `Your ${randomTitle} code: ${Math.random().toString(36).substr(2, 10).toUpperCase()}` : null,
                sellerId: randomUser.id,
                gameId: game.id,
                categoryId: category.id,
                active: true,
                hidden: false,
                boostedAt: Math.random() > 0.9 ? new Date() : null // 10% chance of being boosted
              }
            });

            totalListings++;

            if (totalListings % 100 === 0) {
              console.log(`✅ Added ${totalListings} listings so far...`);
            }
          } catch (error) {
            console.error(`❌ Error adding listing ${i + 1} for ${game.name} - ${category.name}:`, error.message);
          }
        }

        console.log(`✅ Completed adding listings for ${game.name} - ${category.name}`);
      }
    }

    console.log(`🎉 Successfully added ${totalListings} test listings!`);
    
    // Show summary
    const listingCounts = await prisma.listing.groupBy({
      by: ['gameId'],
      _count: {
        id: true
      },
      include: {
        game: {
          select: {
            name: true
          }
        }
      }
    });

    console.log('\n📊 Listing Summary:');
    for (const count of listingCounts) {
      const game = await prisma.game.findUnique({
        where: { id: count.gameId },
        select: { name: true }
      });
      console.log(`  ${game.name}: ${count._count.id} listings`);
    }

  } catch (error) {
    console.error('❌ Error adding test listings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addTestListings();