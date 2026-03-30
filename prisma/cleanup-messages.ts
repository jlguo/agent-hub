import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupMessages() {
  try {
    console.log('🗑️  Starting message cleanup...\n');

    // Count messages before deletion
    const countBefore = await prisma.message.count();
    console.log(`📊 Messages before cleanup: ${countBefore}\n`);

    // Delete all messages
    const result = await prisma.message.deleteMany({});
    console.log(`✅ Deleted ${result.count} messages\n`);

    // Also clean up discussions (they reference messages)
    const discussionResult = await prisma.discussion.deleteMany({});
    console.log(`✅ Deleted ${discussionResult.count} discussions\n`);

    // Verify cleanup
    const countAfter = await prisma.message.count();
    console.log(`📊 Messages after cleanup: ${countAfter}\n`);

    // Show what's preserved
    const rooms = await prisma.room.count();
    const agents = await prisma.agent.count();
    const relationships = await prisma.relationship.count();
    
    console.log('✅ Preserved database structure:');
    console.log(`   - Rooms: ${rooms}`);
    console.log(`   - Agents: ${agents}`);
    console.log(`   - Relationships: ${relationships}`);
    
    console.log('\n✨ Cleanup complete! Fresh start ready.\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupMessages();
