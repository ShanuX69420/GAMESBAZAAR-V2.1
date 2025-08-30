const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const massiveTitles = [
  'Premium Gaming Account', 'Elite Battle Pass', 'Legendary Weapon Skin', 'Mythic Character Bundle',
  'Diamond Rank Account', 'Master Tier Progress', 'Conqueror Title Unlock', 'Professional Setup',
  'Tournament Winner Skin', 'Championship Series', 'Limited Edition Pack', 'Exclusive Beta Access',
  'VIP Membership Benefits', 'Collector\'s Special Edition', 'Rare Cosmetic Bundle', 'Epic Weapon Collection',
  'Anniversary Celebration Pack', 'Season Pass Ultimate', 'Pro Player Edition', 'Streamer Exclusive',
  'Content Creator Bundle', 'Influencer Collaboration', 'Community Event Reward', 'Developer Special',
  'Alpha Tester Exclusive', 'Founder\'s Pack Bonus', 'Early Access Content', 'Premium Currency Mega Pack',
  'Ultimate Gaming Bundle', 'Professional Gaming Setup', 'Esports Team Collaboration', 'Gaming Legend Status',
  'Hall of Fame Edition', 'Championship Trophy', 'Victory Celebration Pack', 'Domination Series',
  'Combat Elite Package', 'Tactical Advantage Bundle', 'Strategic Warfare Set', 'Battle Royale King',
  'Survival Expert Kit', 'Sniper Elite Collection', 'Assault Master Bundle', 'Support Specialist Pack',
  'Heavy Artillery Set', 'Stealth Operations Kit', 'Demolition Expert Bundle', 'Medic Hero Package',
  'Engineer Pro Tools', 'Reconnaissance Specialist', 'Marksman Excellence Set', 'Close Combat Expert',
  'Long Range Specialist', 'Urban Warfare Pack', 'Desert Storm Edition', 'Arctic Combat Bundle',
  'Jungle Warfare Set', 'Naval Operations Kit', 'Airborne Elite Package', 'Special Forces Bundle',
  'Black Ops Collection', 'Covert Operations Set', 'Intelligence Agency Kit', 'Counter-Strike Bundle',
  'Anti-Terrorism Pack', 'Hostage Rescue Set', 'Bomb Defusal Kit', 'VIP Protection Bundle',
  'Security Detail Pack', 'Bodyguard Elite Set', 'Executive Protection Kit', 'Presidential Guard Bundle',
  'Royal Guard Collection', 'Imperial Forces Set', 'Dynasty Warrior Pack', 'Ancient Legend Bundle',
  'Mythical Hero Set', 'Divine Champion Kit', 'Celestial Warrior Pack', 'Cosmic Guardian Bundle',
  'Galactic Defender Set', 'Universal Protector Kit', 'Interdimensional Hero Pack', 'Time Warrior Bundle',
  'Quantum Fighter Set', 'Nano-Tech Hero Kit', 'Cyber Warrior Pack', 'Digital Guardian Bundle',
  'Virtual Reality Set', 'Augmented Hero Kit', 'Holographic Fighter Pack', 'Matrix Defender Bundle',
  'Code Warrior Set', 'Binary Hero Kit', 'Algorithm Fighter Pack', 'Database Guardian Bundle',
  'Network Protector Set', 'Firewall Defender Kit', 'Antivirus Hero Pack', 'Security Expert Bundle',
  'Hacker Hunter Set', 'Cyber Detective Kit', 'Digital Forensic Pack', 'Tech Investigator Bundle',
  'Innovation Pioneer Set', 'Technology Advance Kit', 'Future Warrior Pack', 'Next-Gen Fighter Bundle',
  'Evolution Master Set', 'Transformation Hero Kit', 'Metamorphosis Pack', 'Adaptation Expert Bundle',
  'Survival Instinct Set', 'Natural Selection Kit', 'Evolutionary Advantage Pack', 'Genetic Superior Bundle'
];

const massiveDescriptions = [
  'Ultimate gaming experience with premium features and exclusive content access.',
  'Professional-grade account with years of progression and rare achievements unlocked.',
  'Tournament-quality items used by top-tier competitive players worldwide.',
  'Limited edition collectibles with verified authenticity and market value.',
  'High-performance gaming assets optimized for competitive advantage.',
  'Exclusive content bundle featuring rare cosmetics and unique customizations.',
  'Elite-tier progression with maximum level characters and complete unlocks.',
  'Premium membership benefits including VIP access and priority support.',
  'Collector\'s dream package with historically significant gaming items.',
  'Investment-grade digital assets with proven long-term value appreciation.',
  'Professional esports equipment used in international tournaments.',
  'Rare legacy items from discontinued events and special promotions.',
  'Master-crafted gaming content with exceptional quality and detail.',
  'Legendary status symbols recognized throughout the gaming community.',
  'Championship-winning setup used by professional gaming teams.',
  'Artisan-quality digital craftsmanship with meticulous attention to detail.',
  'Heritage collection featuring classic items from gaming history.',
  'Premium gaming subscription with exclusive perks and benefits.',
  'Elite gaming club membership with access to private servers.',
  'Diplomatic immunity in gaming communities with special privileges.',
  'Royal treatment package with personalized gaming experience.',
  'Celebrity endorsement bundle with influencer collaborations.',
  'Director\'s cut edition with behind-the-scenes content access.',
  'Producer\'s special featuring unreleased content and early access.',
  'Executive privilege package with administrative gaming powers.'
];

async function addMassiveListings() {
  try {
    console.log('🚀 Adding MASSIVE amount of test listings...');

    // Get existing users
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' }
      }
    });

    // Get all games and categories
    const games = await prisma.game.findMany({
      include: {
        categories: true
      }
    });

    console.log(`👥 Found ${users.length} users as sellers`);
    console.log(`🎮 Found ${games.length} games with categories`);

    let totalListings = 0;
    const platforms = ['PC', 'Mobile', 'Console', 'Cross-Platform'];
    const regions = ['Global', 'US', 'EU', 'Asia', 'Pakistan'];
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine'];
    const conditions = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

    // Add 200+ listings per category
    for (const game of games) {
      console.log(`🎮 Processing ${game.name}...`);
      
      for (const category of game.categories) {
        console.log(`📂 Adding listings for ${category.name}...`);

        // 150-250 listings per category
        const numListings = Math.floor(Math.random() * 101) + 150;

        for (let i = 0; i < numListings; i++) {
          const randomUser = users[Math.floor(Math.random() * users.length)];
          const titleIndex = Math.floor(Math.random() * massiveTitles.length);
          const descIndex = Math.floor(Math.random() * massiveDescriptions.length);
          
          const randomTitle = massiveTitles[titleIndex];
          const randomDescription = massiveDescriptions[descIndex];
          
          // Price range: 100-50000 PKR
          const price = Math.floor(Math.random() * 49900) + 100;
          
          // 80% instant delivery for testing
          const deliveryType = Math.random() > 0.2 ? 'instant' : 'manual';
          
          const stockType = Math.random() > 0.5 ? 'unlimited' : 'limited';
          const quantity = stockType === 'unlimited' ? null : Math.floor(Math.random() * 100) + 1;

          // Rich custom fields
          const customFields = {
            platform: platforms[Math.floor(Math.random() * platforms.length)],
            region: regions[Math.floor(Math.random() * regions.length)],
            rarity: rarities[Math.floor(Math.random() * rarities.length)],
            level: Math.floor(Math.random() * 100) + 1,
            experience: Math.floor(Math.random() * 1000000),
            achievements: Math.floor(Math.random() * 500),
            playtime: `${Math.floor(Math.random() * 5000)} hours`
          };

          // Category-specific fields
          if (category.name.toLowerCase().includes('account')) {
            customFields.rank = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster'][Math.floor(Math.random() * 7)];
            customFields.winRate = `${Math.floor(Math.random() * 40) + 60}%`;
            customFields.matchesPlayed = Math.floor(Math.random() * 10000) + 100;
          } else if (category.name.toLowerCase().includes('skin') || category.name.toLowerCase().includes('weapon')) {
            customFields.condition = conditions[Math.floor(Math.random() * conditions.length)];
            customFields.float = (Math.random() * 0.8).toFixed(4);
            customFields.pattern = Math.floor(Math.random() * 1000);
          }

          // 90% chance of having images (1-5 images)
          const images = [];
          if (Math.random() > 0.1) {
            const numImages = Math.floor(Math.random() * 5) + 1;
            for (let j = 0; j < numImages; j++) {
              images.push(`https://picsum.photos/400/300?random=${totalListings + i + j + 5000}`);
            }
          }

          try {
            await prisma.listing.create({
              data: {
                title: `${randomTitle} ${i + 1} [${game.name}]`,
                description: `${randomDescription} \n\n🎮 Game: ${game.name}\n📂 Category: ${category.name}\n⭐ Quality: Premium\n🚀 Fast Delivery: ${deliveryType === 'instant' ? 'Yes' : 'Manual'}\n💎 Rarity: ${customFields.rarity}\n📊 Level: ${customFields.level}`,
                price: price,
                deliveryType: deliveryType,
                stockType: stockType,
                quantity: quantity,
                images: images,
                customFields: customFields,
                deliveryContent: deliveryType === 'instant' ? 
                  `🎉 INSTANT DELIVERY ACTIVATED!\n\n📦 Your ${randomTitle}\n🎮 Game: ${game.name}\n🔑 Access Code: ${Math.random().toString(36).substr(2, 16).toUpperCase()}\n📧 Login: user${Math.floor(Math.random() * 10000)}@gaming.com\n🔒 Password: ${Math.random().toString(36).substr(2, 10)}\n\n📝 Instructions:\n1. Login immediately\n2. Change password\n3. Verify email\n4. Enjoy your purchase!\n\n⚡ Support: Message seller for assistance\n🛡️ Warranty: 24 hours replacement guarantee` : null,
                sellerId: randomUser.id,
                gameId: game.id,
                categoryId: category.id,
                active: true,
                hidden: false,
                boostedAt: Math.random() > 0.9 ? new Date() : null // 10% boosted
              }
            });

            totalListings++;

            if (totalListings % 500 === 0) {
              console.log(`⚡ Added ${totalListings} listings so far...`);
            }
          } catch (error) {
            console.error(`❌ Error adding listing ${i}:`, error.message);
          }
        }

        console.log(`✅ Added ~${numListings} listings for ${game.name} - ${category.name}`);
      }
    }

    console.log(`🎉 SUCCESS! Added ${totalListings} MORE listings!`);
    
    // Final count
    const finalCount = await prisma.listing.count();
    console.log(`📊 TOTAL LISTINGS IN DATABASE: ${finalCount}`);
    
    // Count per game
    console.log('\n🏆 Final Statistics:');
    for (const game of games) {
      const gameListings = await prisma.listing.count({
        where: { gameId: game.id }
      });
      console.log(`  ${game.name}: ${gameListings} listings`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMassiveListings();