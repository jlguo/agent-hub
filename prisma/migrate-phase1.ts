import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Phase 1 Data Migration ===\n');
  
  // 1. Migrate Message.role to Message.senderType
  console.log('1. Migrating messages to senderType...');
  const messages = await prisma.message.findMany({
    select: { id: true, agentId: true }
  });
  
  let humanCount = 0;
  let agentCount = 0;
  
  for (const msg of messages) {
    const senderType = msg.agentId ? 'agent' : 'human';
    await prisma.message.update({
      where: { id: msg.id },
      data: { senderType }
    });
    if (senderType === 'human') humanCount++;
    else agentCount++;
  }
  
  console.log(`   ✅ Migrated ${messages.length} messages`);
  console.log(`      - Human messages: ${humanCount}`);
  console.log(`      - Agent messages: ${agentCount}`);
  
  // 2. Normalize agent trait values (0-10 scale detected -> convert to 0-100)
  console.log('\n2. Normalizing agent trait values...');
  const agents = await prisma.agent.findMany({
    select: { id: true, name: true, talkativeness: true, empathy: true, curiosity: true }
  });
  
  let normalizedCount = 0;
  for (const agent of agents) {
    // If values are <= 10, they're on 0-10 scale - convert to 0-100
    if (agent.talkativeness <= 10 || agent.empathy <= 10 || agent.curiosity <= 10) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          talkativeness: Math.min(100, agent.talkativeness * 10),
          empathy: Math.min(100, agent.empathy * 10),
          curiosity: Math.min(100, agent.curiosity * 10)
        }
      });
      normalizedCount++;
      console.log(`   ✅ ${agent.name}: ${agent.talkativeness}/${agent.empathy}/${agent.curiosity} → ${agent.talkativeness * 10}/${agent.empathy * 10}/${agent.curiosity * 10}`);
    }
  }
  
  if (normalizedCount === 0) {
    console.log('   ℹ️  No agents needed normalization (already 0-100 scale)');
  } else {
    console.log(`   ✅ Normalized ${normalizedCount} agents to 0-100 scale`);
  }
  
  // 3. Link messages to discussions (assign to most recent active discussion per room)
  console.log('\n3. Linking messages to discussions...');
  const rooms = await prisma.room.findMany({
    include: {
      discussions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      messages: {
        where: { discussionId: null },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  
  let linkedCount = 0;
  for (const room of rooms) {
    if (room.discussions.length === 0) continue;
    
    const discussion = room.discussions[0];
    for (const msg of room.messages) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { discussionId: discussion.id }
      });
      linkedCount++;
    }
    
    if (room.messages.length > 0) {
      console.log(`   ✅ Room "${room.name}": linked ${room.messages.length} messages to discussion "${discussion.topic}"`);
    }
  }
  
  if (linkedCount === 0) {
    console.log('   ℹ️  No messages needed linking (all already assigned)');
  } else {
    console.log(`   ✅ Linked ${linkedCount} messages to discussions`);
  }
  
  // 4. Show final statistics
  console.log('\n=== Migration Complete ===\n');
  const stats = {
    rooms: await prisma.room.count(),
    agents: await prisma.agent.count(),
    messages: await prisma.message.count(),
    discussions: await prisma.discussion.count(),
    sessions: await prisma.session.count()
  };
  
  console.log('Database Statistics:');
  console.log(`  - Rooms: ${stats.rooms}`);
  console.log(`  - Agents: ${stats.agents}`);
  console.log(`  - Messages: ${stats.messages}`);
  console.log(`  - Discussions: ${stats.discussions}`);
  console.log(`  - Sessions: ${stats.sessions}`);
  console.log('\n✅ Phase 1 migration completed successfully!\n');
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
