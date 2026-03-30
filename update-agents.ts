import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Updating Agent Database ===\n');
  
  // Get the room to associate agents with
  const room = await prisma.room.findFirst({
    where: { name: 'Family' }
  });
  
  if (!room) {
    console.error('❌ Family room not found!');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ Found room: ${room.id} (${room.name})\n`);
  
  // Agents to add/update
  const agents = [
    { id: 'family-bro', name: 'Bro', role: 'brother', talkativeness: 6, empathy: 5, curiosity: 7 },
    { id: 'family-sis', name: 'Sis', role: 'sister', talkativeness: 7, empathy: 6, curiosity: 8 },
    { id: 'family-grandma', name: 'Grandma', role: 'grandmother', talkativeness: 7, empathy: 9, curiosity: 6 },
    { id: 'family-grandpa', name: 'Grandpa', role: 'grandfather', talkativeness: 6, empathy: 8, curiosity: 5 },
  ];
  
  for (const agentData of agents) {
    try {
      const agent = await prisma.agent.upsert({
        where: { id: agentData.id },
        update: {
          name: agentData.name,
          role: agentData.role,
          talkativeness: agentData.talkativeness,
          empathy: agentData.empathy,
          curiosity: agentData.curiosity,
        },
        create: {
          id: agentData.id,
          roomId: room.id,
          name: agentData.name,
          role: agentData.role,
          talkativeness: agentData.talkativeness,
          empathy: agentData.empathy,
          curiosity: agentData.curiosity,
          avatar: getAvatar(agentData.id),
        },
      });
      
      console.log(`✅ ${agent.id} (${agent.name}) - ${agent.role}`);
    } catch (error: any) {
      console.error(`❌ Failed to update ${agentData.id}: ${error.message}`);
    }
  }
  
  console.log('\n=== Agent Update Complete ===\n');
  
  // Show all agents
  const allAgents = await prisma.agent.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' }
  });
  
  console.log('\n=== All Agents in Database ===\n');
  allAgents.forEach(a => console.log(`${a.id.padEnd(20)} | ${a.name.padEnd(10)} | ${a.role}`));
  console.log(`\nTotal: ${allAgents.length} agents\n`);
  
  await prisma.$disconnect();
}

function getAvatar(agentId: string): string {
  const avatars: Record<string, string> = {
    'family-mom': '👩',
    'family-dad': '👨',
    'family-bro': '👦',
    'family-sis': '👧',
    'family-grandma': '👵',
    'family-grandpa': '👴',
  };
  return avatars[agentId] || '👤';
}

main().catch(console.error);
