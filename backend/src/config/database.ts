import { PrismaClient } from '@prisma/client';

// Create Prisma client instance
export const prisma = new PrismaClient({
  log: ['error', 'warn'], // Log errors and warnings
  errorFormat: 'pretty'
});

// Connect to database and handle shutdown
export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  await disconnectDatabase();
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
});