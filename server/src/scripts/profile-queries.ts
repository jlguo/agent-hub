/**
 * Database Query Performance Profiler
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function profileQueries() {
  console.log('=== Database Query Performance Profile ===\n');
  
  // Profile 1: Get all rooms with agents
  console.time('GET_ROOMS_WITH_AGENTS');
  const rooms = await prisma.room.findMany({
    include: {
      agents: true,
      _count: { select: { messages: true, discussions: true } }
    }
  });
  console.timeEnd('GET_ROOMS_WITH_AGENTS');
  
  // Profile 2: Get messages for room (50 messages)
  console.time('GET_MESSAGES_FOR_ROOM');
  const messages = await prisma.message.findMany({
    where: { roomId: 'family-room-demo' },
    include: { agent: { select: { name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  console.timeEnd('GET_MESSAGES_FOR_ROOM');
  
  // Profile 3: Get agent by ID
  console.time('GET_AGENT_BY_ID');
  const agent = await prisma.agent.findUnique({
    where: { id: 'family-mom' },
    include: { relationshipsAsA: true, relationshipsAsB: true }
  });
  console.timeEnd('GET_AGENT_BY_ID');
  
  // Profile 4: Get discussions
  console.time('GET_DISCUSSIONS');
  const discussions = await prisma.discussion.findMany({
    where: { roomId: 'family-room-demo' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.timeEnd('GET_DISCUSSIONS');
  
  console.log('\n=== Summary ===');
  console.log('Rooms:', rooms.length);
  console.log('Messages:', messages.length);
  console.log('Agent:', agent?.name);
  console.log('Discussions:', discussions.length);
  
  await prisma.$disconnect();
}

profileQueries().catch(console.error);
