import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.agent.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' }
  });
  
  console.log('\n=== Agents in Database ===\n');
  agents.forEach(a => console.log(`ID: ${a.id} | Name: ${a.name} | Role: ${a.role}`));
  console.log(`\nTotal: ${agents.length} agents\n`);
  
  await prisma.$disconnect();
}
main().catch(console.error);
