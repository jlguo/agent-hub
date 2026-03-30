import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fix all family relationships
 * Creates bidirectional relationships for the Zhang family
 */
async function fixFamilyRelationships() {
  console.log('🔧 Fixing Family Relationships\n');
  
  // Get all agents
  const agents = await prisma.agent.findMany();
  const agentMap = new Map(agents.map(a => [a.name.toLowerCase(), a]));
  
  console.log('📊 Current Agents:');
  agents.forEach(a => {
    console.log(`  - ${a.name} (${a.id})`);
  });
  
  // Define all family relationships (bidirectional)
  const relationships = [
    // Dad ↔ Mom (spouse)
    { agentA: 'dad', agentB: 'mom', type: 'spouse', strength: 90 },
    
    // Dad ↔ Bro (parent-child)
    { agentA: 'dad', agentB: 'bro', type: 'parent-of', strength: 90 },
    { agentA: 'bro', agentB: 'dad', type: 'child-of', strength: 95 },
    
    // Dad ↔ Sis (parent-child)
    { agentA: 'dad', agentB: 'sis', type: 'parent-of', strength: 90 },
    { agentA: 'sis', agentB: 'dad', type: 'child-of', strength: 95 },
    
    // Mom ↔ Bro (parent-child)
    { agentA: 'mom', agentB: 'bro', type: 'parent-of', strength: 90 },
    { agentA: 'bro', agentB: 'mom', type: 'child-of', strength: 95 },
    
    // Mom ↔ Sis (parent-child) - ALREADY EXISTS
    // { agentA: 'mom', agentB: 'sis', type: 'parent-of', strength: 95 },
    // { agentA: 'sis', agentB: 'mom', type: 'child-of', strength: 95 },
    
    // Bro ↔ Sis (siblings)
    { agentA: 'bro', agentB: 'sis', type: 'sibling-of', strength: 85 },
    { agentA: 'sis', agentB: 'bro', type: 'sibling-of', strength: 85 },
    
    // Dad ↔ Grandma (child-parent)
    { agentA: 'dad', agentB: 'grandma', type: 'child-of', strength: 90 },
    { agentA: 'grandma', agentB: 'dad', type: 'parent-of', strength: 95 },
    
    // Dad ↔ Grandpa (child-parent)
    { agentA: 'dad', agentB: 'grandpa', type: 'child-of', strength: 90 },
    { agentA: 'grandpa', agentB: 'dad', type: 'parent-of', strength: 95 },
    
    // Mom ↔ Grandma (child-in-law - parent-in-law)
    { agentA: 'mom', agentB: 'grandma', type: 'child-in-law-of', strength: 85 },
    { agentA: 'grandma', agentB: 'mom', type: 'parent-in-law-of', strength: 85 },
    
    // Mom ↔ Grandpa (child-in-law - parent-in-law)
    { agentA: 'mom', agentB: 'grandpa', type: 'child-in-law-of', strength: 85 },
    { agentA: 'grandpa', agentB: 'mom', type: 'parent-in-law-of', strength: 85 },
    
    // Grandma ↔ Grandpa (spouse)
    { agentA: 'grandma', agentB: 'grandpa', type: 'spouse', strength: 95 },
    
    // Bro ↔ Grandma (grandchild-grandparent)
    { agentA: 'bro', agentB: 'grandma', type: 'grandchild-of', strength: 90 },
    { agentA: 'grandma', agentB: 'bro', type: 'grandparent-of', strength: 95 },
    
    // Bro ↔ Grandpa (grandchild-grandparent)
    { agentA: 'bro', agentB: 'grandpa', type: 'grandchild-of', strength: 90 },
    { agentA: 'grandpa', agentB: 'bro', type: 'grandparent-of', strength: 95 },
    
    // Sis ↔ Grandma (grandchild-grandparent)
    { agentA: 'sis', agentB: 'grandma', type: 'grandchild-of', strength: 90 },
    { agentA: 'grandma', agentB: 'sis', type: 'grandparent-of', strength: 95 },
    
    // Sis ↔ Grandpa (grandchild-grandparent)
    { agentA: 'sis', agentB: 'grandpa', type: 'grandchild-of', strength: 90 },
    { agentA: 'grandpa', agentB: 'sis', type: 'grandparent-of', strength: 95 },
  ];
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  console.log('\n📝 Creating Relationships:\n');
  
  for (const rel of relationships) {
    const agentA = agentMap.get(rel.agentA);
    const agentB = agentMap.get(rel.agentB);
    
    if (!agentA || !agentB) {
      console.log(`⚠️  Skip: ${rel.agentA} or ${rel.agentB} not found`);
      errors++;
      continue;
    }
    
    try {
      // Check if relationship already exists
      const existing = await prisma.relationship.findFirst({
        where: {
          agentAId: agentA.id,
          agentBId: agentB.id,
        },
      });
      
      if (existing) {
        console.log(`✓ Skip: ${agentA.name} ↔ ${agentB.name} (${rel.type}) - already exists`);
        skipped++;
        continue;
      }
      
      // Create relationship
      await prisma.relationship.create({
        data: {
          agentAId: agentA.id,
          agentBId: agentB.id,
          type: rel.type,
          strength: rel.strength,
        },
      });
      
      console.log(`✅ Created: ${agentA.name} ↔ ${agentB.name} (${rel.type}, strength: ${rel.strength})`);
      created++;
      
    } catch (error: any) {
      console.error(`❌ Error: ${agentA.name} ↔ ${agentB.name} - ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  ✅ Created: ${created}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📈 Total: ${created + skipped + errors}`);
  
  // Verify final state
  console.log('\n🔍 Verification:');
  const allRelationships = await prisma.relationship.findMany({
    include: {
      agentA: { select: { name: true } },
      agentB: { select: { name: true } },
    },
  });
  
  console.log(`\nTotal relationships in database: ${allRelationships.length}\n`);
  
  // Group by agent
  const agentRels = new Map<string, string[]>();
  allRelationships.forEach(rel => {
    const aName = rel.agentA.name;
    const bName = rel.agentB.name;
    const relText = `${aName} ↔ ${bName} (${rel.type})`;
    
    if (!agentRels.has(aName)) agentRels.set(aName, []);
    if (!agentRels.has(bName)) agentRels.set(bName, []);
    
    agentRels.get(aName)!.push(relText);
    agentRels.get(bName)!.push(relText);
  });
  
  console.log('Relationships per agent:');
  agentRels.forEach((rels, agentName) => {
    console.log(`\n  ${agentName}: ${rels.length} relationships`);
    rels.forEach(r => console.log(`    - ${r}`));
  });
  
  await prisma.$disconnect();
  
  console.log('\n✅ Relationship fix complete!\n');
}

fixFamilyRelationships().catch(console.error);
