import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Family room
  const familyRoom = await prisma.room.upsert({
    where: { id: 'family-room-demo' },
    update: {},
    create: {
      id: 'family-room-demo',
      name: 'Family',
      type: 'family',
      description: 'A warm family conversation space',
      context: 'A typical Chinese family with parents, a child, and grandparents. Conversations are warm, caring, and sometimes playful.',
    },
  });

  console.log('✓ Created Family room');

  // Create agents
  const dad = await prisma.agent.upsert({
    where: { roomId_name: { roomId: familyRoom.id, name: 'Dad' } },
    update: {
      talkativeness: 70,
      empathy: 60,
      curiosity: 50,
      role: 'father',
    },
    create: {
      roomId: familyRoom.id,
      name: 'Dad',
      role: 'father',
      avatar: '👨',
      talkativeness: 70,
      empathy: 60,
      curiosity: 50,
      responseDelay: 1500,
      systemPrompt: 'You are a caring father who loves to share stories and give advice. You are talkative and enjoy family conversations.',
    },
  });

  const mom = await prisma.agent.upsert({
    where: { roomId_name: { roomId: familyRoom.id, name: 'Mom' } },
    update: {
      talkativeness: 60,
      empathy: 80,
      curiosity: 60,
      role: 'mother',
    },
    create: {
      roomId: familyRoom.id,
      name: 'Mom',
      role: 'mother',
      avatar: '👩',
      talkativeness: 60,
      empathy: 80,
      curiosity: 60,
      responseDelay: 1200,
      systemPrompt: 'You are a warm and empathetic mother who cares deeply about the family. You listen well and offer thoughtful responses.',
    },
  });

  const child = await prisma.agent.upsert({
    where: { roomId_name: { roomId: familyRoom.id, name: 'Child' } },
    update: {
      talkativeness: 50,
      empathy: 40,
      curiosity: 80,
      role: 'child',
    },
    create: {
      roomId: familyRoom.id,
      name: 'Child',
      role: 'child',
      avatar: '👦',
      talkativeness: 50,
      empathy: 40,
      curiosity: 80,
      responseDelay: 800,
      systemPrompt: 'You are a curious and energetic child who loves to ask questions and learn new things. You are playful and sometimes mischievous.',
    },
  });

  console.log('✓ Created agents: Dad, Mom, Child');

  // Create relationships
  await prisma.relationship.upsert({
    where: { agentAId_agentBId: { agentAId: dad.id, agentBId: mom.id } },
    update: {},
    create: {
      agentAId: dad.id,
      agentBId: mom.id,
      type: 'spouse',
      strength: 90,
      context: 'Loving married couple for 15 years',
    },
  });

  await prisma.relationship.upsert({
    where: { agentAId_agentBId: { agentAId: dad.id, agentBId: child.id } },
    update: {},
    create: {
      agentAId: dad.id,
      agentBId: child.id,
      type: 'parent-of',
      strength: 95,
      context: 'Proud father, sometimes strict but always loving',
    },
  });

  await prisma.relationship.upsert({
    where: { agentAId_agentBId: { agentAId: mom.id, agentBId: child.id } },
    update: {},
    create: {
      agentAId: mom.id,
      agentBId: child.id,
      type: 'parent-of',
      strength: 95,
      context: 'Nurturing mother, very attentive to child\'s needs',
    },
  });

  console.log('✓ Created relationships');

  // Create a sample discussion
  const discussion = await prisma.discussion.create({
    data: {
      roomId: familyRoom.id,
      topic: 'What should we do this weekend?',
      heatScore: 75,
      status: 'active',
      participants: JSON.stringify([dad.id, mom.id, child.id]),
    },
  });

  console.log('✓ Created sample discussion');

  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('Demo data:');
  console.log(`  Room: ${familyRoom.name} (${familyRoom.id})`);
  console.log(`  Agents: Dad, Mom, Child`);
  console.log(`  Discussion: "${discussion.topic}"`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
