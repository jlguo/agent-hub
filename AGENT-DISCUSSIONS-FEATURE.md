# Agent-to-Agent Discussions 🎙️

**Date**: 2026-03-30  
**Status**: ✅ Complete

---

## 🎯 **Feature Overview**

Enable **autonomous discussions** among family agents - they talk to each other, not just to you!

### **Before**
```
You: @Mom @Dad 周末去哪里玩？
Mom: 去公园吧！
(You have to ask each agent individually)
```

### **After**
```
You: /discuss 周末去哪里玩

[Discussion Starts]
Mom: 我觉得可以去公园野餐，天气这么好！
Dad: 公园不错，不过要不要考虑去海边？
Bro: 海边太远了，而且我还有作业没写完...
Grandma: 乖孙们别争了，奶奶觉得公园挺好的～
Sis: 对啊对啊，而且公园还可以放风筝！🪁

[Discussion Ends - 5 turns]
```

---

## 🚀 **How to Use**

### **Trigger Commands**

Any of these will start a discussion:

```
/discuss [topic]
Let's discuss [topic]
咱们讨论一下 [topic]
讨论 [topic]
```

### **Examples**

```
/discuss 周末去哪里玩
Let's discuss what to have for dinner
咱们讨论一下春节怎么过
讨论 暑假旅游计划
```

---

## ⚙️ **Configuration**

```typescript
const DISCUSSION_CONFIG = {
  MIN_TURNS: 4,           // Minimum 4 turns
  MAX_TURNS: 8,           // Maximum 8 turns
  TURN_DELAY_MS: 3000,    // 3 seconds between turns
  PARTICIPANTS: {
    MIN: 2,               // At least 2 agents
    MAX: 4,               // At most 4 agents
  },
};
```

### **Customization**

Edit `/home/jlguo/agent-hub/server/src/services/DiscussionService.ts`:

```typescript
// More turns for longer discussions
MIN_TURNS: 6,
MAX_TURNS: 12,

// Faster responses
TURN_DELAY_MS: 2000,

// More participants
PARTICIPANTS: {
  MIN: 3,
  MAX: 6,
},
```

---

## 🎭 **Discussion Flow**

### **1. Trigger Detection**
```typescript
User: /discuss 周末去哪里玩
       ↓
System detects "/discuss" pattern
       ↓
Extracts topic: "周末去哪里玩"
```

### **2. Agent Selection**
```
Available: Dad, Mom, Bro, Sis, Grandma, Grandpa
Selected: Mom, Dad, Bro, Grandma (random 2-4 agents)
```

### **3. Turn-Taking**
```
Turn 1: Mom responds to topic
Turn 2: Dad responds to Mom
Turn 3: Bro responds to Dad
Turn 4: Grandma responds to Bro
...
Turn 8: Final agent wraps up
```

### **4. Context Awareness**
Each agent sees:
- Previous agent's message
- Full conversation history (last 15 messages)
- Discussion topic
- Their relationships with other agents

---

## 💬 **Example Discussions**

### **Example 1: Weekend Plans**
```
You: /discuss 周末去哪里玩

🎙️ Discussion Started: 周末去哪里玩
Participants: Mom, Dad, Bro, Grandma

Mom: 我觉得可以去公园野餐，天气这么好！
Dad: 公园不错，不过要不要考虑去海边？
Bro: 海边太远了，而且我还有作业没写完...
Grandma: 乖孙们别争了，奶奶觉得公园挺好的～
Mom: 对啊，公园还可以一起做饭！
Dad: 那好吧，听奶奶的！
Bro: 好吧好吧，我去准备游戏～
Grandma: 这才是一家人嘛！❤️

🎙️ Discussion Ended
```

### **Example 2: Dinner Plans**
```
You: Let's discuss what to have for dinner

🎙️ Discussion Started: what to have for dinner
Participants: Dad, Mom, Sis

Dad: I'm craving some homemade noodles!
Mom: That's a great idea! I can make the broth.
Sis: Can we add vegetables? I want something healthy!
Dad: Of course! Let's make it a family effort!
Mom: Perfect! Everyone can help!

🎙️ Discussion Ended
```

### **Example 3: Holiday Planning**
```
You: 咱们讨论一下春节怎么过

🎙️ Discussion Started: 春节怎么过
Participants: Grandma, Grandpa, Mom, Dad, Sis

Grandma: 今年春节咱们一家人团聚最重要！
Grandpa: 对，我准备写几副春联给大家！
Mom: 我来准备年夜饭的菜单！
Dad: 我负责买年货和装饰！
Sis: 我可以帮忙包饺子！🥟
Grandma: 好好好，咱们一起过个热闹年！
Mom: 对了，要不要邀请舅舅他们也来？
Dad: 好主意！人多更热闹！

🎙️ Discussion Ended
```

---

## 🎯 **Key Features**

### **1. Autonomous Conversation**
- Agents talk to **each other**, not just to you
- Each agent responds to **previous agent's message**
- Natural conversation flow with turn-taking

### **2. Context Awareness**
- Agents reference what others said
- Maintains topic throughout discussion
- Uses relationship dynamics (family roles)

### **3. Variable Length**
- Random 4-8 turns per discussion
- Prevents predictability
- Keeps conversations fresh

### **4. Multiple Participants**
- 2-4 agents per discussion
- Different agents each time
- Ensures diverse perspectives

### **5. Visual Indicators**
```
🎙️ **Discussion Started**: [topic]
Participants: [names]

[Agent messages...]

🎙️ **Discussion Ended**
```

---

## 🔧 **Implementation Details**

### **File Structure**

```
/home/jlguo/agent-hub/server/src/services/
├── DiscussionService.ts    ← New service
├── MessageService.ts       ← Normal agent responses
└── OpenClawService.ts      ← LLM integration
```

### **Key Functions**

#### **1. parseDiscussionTrigger()**
```typescript
function parseDiscussionTrigger(message: string): string | null {
  // Detects: /discuss, "let's discuss", "咱们讨论一下"
  // Returns: topic string or null
}
```

#### **2. selectDiscussionParticipants()**
```typescript
async function selectDiscussionParticipants(
  topic: string,
  roomId: string,
  count: number = 3
): Promise<Agent[]> {
  // Selects 2-4 random agents from room
}
```

#### **3. triggerAgentDiscussion()**
```typescript
export async function triggerAgentDiscussion(
  roomId: string,
  topic: string,
  initiatorId?: string
) {
  // Main discussion loop
  // Runs 4-8 turns with 3s delays
}
```

---

## 📊 **Discussion vs Normal Chat**

| Feature | Normal Chat | Discussion Mode |
|---------|-------------|-----------------|
| Trigger | Any message | `/discuss [topic]` |
| Participants | 1 agent | 2-4 agents |
| Turns | 1 response | 4-8 responses |
| Context | User message | Previous agent message |
| Delay | Immediate | 3s between turns |
| Duration | ~5s | 15-30s |
| Format | Q&A | Conversation |

---

## 🎮 **Advanced Usage**

### **Chain Discussions**
```
You: /discuss 周末活动
[Discussion ends]

You: /discuss 具体去哪里
[New discussion with different agents]
```

### **Targeted Discussions**
```
You: @Mom @Dad /discuss 暑假计划
[Only Mom and Dad participate]
```

### **Long Discussions**
```
You: /discuss 家庭未来规划
[8 turns, all family members]
```

---

## 🐛 **Troubleshooting**

### **Discussion Not Starting**
```
Check: Message starts with /discuss or similar pattern
Check: Topic is extracted correctly
Check: At least 2 agents in room
```

### **Agents Not Responding**
```
Check: OpenClaw service is running
Check: Agents have SOUL.md personas
Check: No errors in server logs
```

### **Discussion Too Short/Long**
```
Fix: Adjust MIN_TURNS and MAX_TURNS in DiscussionService.ts
```

### **Turns Too Fast/Slow**
```
Fix: Adjust TURN_DELAY_MS in DiscussionService.ts
```

---

## 📈 **Future Enhancements**

### **1. Topic-Based Selection**
```typescript
// Select agents based on topic relevance
if (topic.includes('食物') || topic.includes('吃')) {
  prioritizeAgents(['Mom', 'Grandma']); // Best cooks
}
```

### **2. Agent Availability**
```typescript
// Check if agent is "busy" before selecting
if (agent.status === 'busy') {
  skipAgent(agent);
}
```

### **3. Discussion Summaries**
```typescript
// After discussion, summarize key points
Summary: "Family agreed on park picnic for weekend"
```

### **4. Vote/Decision**
```typescript
// End discussion with vote
"Let's vote: Park 🙆, Beach 🙅"
Result: Park wins 3-2
```

### **5. User Interruption**
```typescript
// User can join discussion mid-way
You: 我也想去公园！
Agents: Great! Everyone agreed!
```

---

## 🎊 **Summary**

| Feature | Status |
|---------|--------|
| Discussion trigger detection | ✅ Complete |
| Agent selection (2-4) | ✅ Complete |
| Turn-taking with delays | ✅ Complete |
| Context-aware responses | ✅ Complete |
| Visual indicators | ✅ Complete |
| Database persistence | ✅ Complete |
| WebSocket broadcasting | ✅ Complete |

**Result**: Agents can now have **autonomous discussions** without user intervention! 🎙️

---

## 🚀 **Testing**

```bash
# Restart backend
cd /home/jlguo/agent-hub
pkill -f "tsx watch"
npm run dev

# Test in Web UI
/discuss 周末去哪里玩
```

**Expected**: 2-4 agents discuss for 4-8 turns with 3s delays! 🎉
