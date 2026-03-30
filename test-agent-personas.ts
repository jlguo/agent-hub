import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const testMessages = [
  { agent: 'family-mom', message: '妈，我饿了', expected: '关心吃饭、做饭' },
  { agent: 'family-dad', message: '爸，今天工作好累', expected: '鼓励、关心工作' },
  { agent: 'family-bro', message: '哥，周末去打篮球吗', expected: '兴奋、运动话题' },
  { agent: 'family-sis', message: '姐，这件衣服好看吗', expected: '活泼、购物话题' },
  { agent: 'family-grandma', message: '奶奶，我想你了', expected: '慈祥、疼爱孙辈' },
  { agent: 'family-grandpa', message: '爷爷，给我讲个故事吧', expected: '历史故事、典故' },
];

async function testAgentResponse(agentId: string, message: string) {
  try {
    const command = `openclaw agent --local --session-id test-${agentId} --message "${message}" 2>&1 | grep -v "\\[plugins\\]" | head -20`;
    const { stdout } = await execAsync(command);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing: ${agentId}`);
    console.log(`💬 Message: "${message}"`);
    console.log(`📝 Response:`);
    console.log(stdout.trim());
    console.log(`${'='.repeat(60)}`);
    
    return { agentId, success: true, response: stdout.trim() };
  } catch (error: any) {
    console.log(`\n❌ Error testing ${agentId}: ${error.message}`);
    return { agentId, success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting Agent Persona Tests\n');
  
  // Get all agents from database
  const agents = await prisma.agent.findMany({
    where: { id: { in: testMessages.map(t => t.agent) } },
    select: { id: true, name: true, role: true, talkativeness: true, empathy: true, curiosity: true, avatar: true }
  });
  
  console.log('📊 Database Agents:');
  console.table(agents.map(a => ({
    ID: a.id,
    Name: a.name,
    Role: a.role,
    Avatar: a.avatar,
    Talk: a.talkativeness,
    Emp: a.empathy,
    Cur: a.curiosity
  })));
  
  console.log('\n🧪 Testing Agent Responses...\n');
  
  const results = [];
  for (const test of testMessages) {
    const result = await testAgentResponse(test.agent, test.message);
    results.push(result);
    
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📈 Test Summary:');
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Passed: ${successCount}/${results.length}`);
  
  if (successCount < results.length) {
    console.log('\n❌ Failed agents:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.agentId}: ${r.error}`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
