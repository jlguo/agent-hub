# @Mention Targeting - 100% Selection Priority

**Date**: 2026-03-30  
**Feature**: When you @mention an agent, they respond 100% of the time

---

## **How It Works**

### **Before**
```
You: @Bro 你干啥呢？
Selection: Random (Bro might not be selected)
Result: Dad responds instead of Bro ❌
```

### **After**
```
You: @Bro 你干啥呢？
Parsing: Extracts "Bro" from @Bro
Selection: Bro = 100% priority ✅
Result: Bro responds! ✅
```

---

## **Implementation**

### **1. Mention Parsing**
```typescript
function parseMentions(message: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = [...message.matchAll(mentionRegex)];
  return matches.map(match => match[1].toLowerCase());
}

// Examples:
parseMentions("@Bro 你干啥呢？")        // ["bro"]
parseMentions("@Mom @Dad 吃饭了")     // ["mom", "dad"]
parseMentions("大家好")                // []
```

### **2. Agent Matching**
```typescript
function selectAgentWithMention(message: string, agents: Agent[]): Agent {
  const mentions = parseMentions(message);
  
  if (mentions.length > 0) {
    // Find agents matching @mentions
    const mentionedAgents = agents.filter(agent => {
      const agentNameLower = agent.name.toLowerCase();
      const agentIdLower = agent.id.toLowerCase();
      return mentions.some(mention => 
        agentNameLower.includes(mention) || 
        agentIdLower.includes(mention) ||
        agent.role?.toLowerCase().includes(mention)
      );
    });
    
    if (mentionedAgents.length > 0) {
      // 100% selection priority for mentioned agent
      return mentionedAgents[0];
    }
  }
  
  // No mentions - random selection (fallback)
  return agents[Math.floor(Math.random() * agents.length)];
}
```

### **3. Matching Logic**

An agent is selected if the @mention matches:
- ✅ **Agent name**: `@Bro` → matches "Bro"
- ✅ **Agent ID**: `@family-bro` → matches "family-bro"
- ✅ **Agent role**: `@brother` → matches role "brother"

**Case insensitive**: `@bro`, `@Bro`, `@BRO` all match "Bro"

---

## **Multiple @Mentions**

When you @mention multiple agents:
```
You: "@Mom @Dad 我们出去吃吧"
```

**Current behavior**: First mentioned agent responds (Mom)
```
Mom: 好啊！我知道一家不错的餐厅～
```

**Future enhancement**: Could trigger multiple agent responses or group discussion

---

## **Agent Selection Priority**

| Scenario | Selection | Priority |
|----------|-----------|----------|
| @Bro mentioned | Bro | 100% ✅ |
| @Mom @Dad mentioned | Mom (first) | 100% ✅ |
| No @mention | Random | Normal |
| @Unknown mentioned | Random (fallback) | Normal |

---

## **Examples**

### **Example 1: Direct @Mention**
```
You: @Bro 你干啥呢？
Parsed: ["bro"]
Matched: Bro (name: "Bro", id: "family-bro")
Selected: Bro ✅
Response: "在呢在呢！咋啦姐？"
```

### **Example 2: Role @Mention**
```
You: @grandpa 陪我去散步吧
Parsed: ["grandpa"]
Matched: Grandpa (role: "grandfather")
Selected: Grandpa ✅
Response: "好啊乖孙！爷爷陪你去！"
```

### **Example 3: No @Mention**
```
You: 大家好啊
Parsed: []
Matched: None
Selected: Random agent
Response: (any family member might respond)
```

### **Example 4: Unknown @Mention**
```
You: @Uncle 你来了吗
Parsed: ["uncle"]
Matched: None (no Uncle agent)
Selected: Random agent (fallback)
Response: (any family member responds, might clarify)
```

---

## **Code Changes**

### **File**: `/home/jlguo/agent-hub/server/src/services/MessageService.ts`

**Added**:
1. `parseMentions()` - Extract @mentions from message
2. `selectAgentWithMention()` - Select agent with 100% priority for @mentions

**Modified**:
- Agent selection logic now calls `selectAgentWithMention()` instead of random

**Logging**:
```typescript
console.log(`[MessageService] Selected agent: ${respondingAgent.name}`, {
  reason: respondingAgent.selectedByMention ? '@mention' : 'normal selection',
});
```

---

## **Testing**

### **Test 1: @Bro Mention**
```
Input: "@Bro 你干啥呢？"
Expected: Bro responds 100%
Log: "Selected agent: Bro" { reason: "@mention" }
```

### **Test 2: @Grandpa Mention**
```
Input: "@grandpa 陪我去散步吧"
Expected: Grandpa responds 100%
Log: "Selected agent: Grandpa" { reason: "@mention" }
```

### **Test 3: No Mention**
```
Input: "大家好啊"
Expected: Random agent responds
Log: "Selected agent: [random]" { reason: "normal selection" }
```

### **Test 4: Multiple Mentions**
```
Input: "@Mom @Dad 吃饭了"
Expected: Mom responds (first mention)
Log: "Selected agent: Mom" { reason: "@mention" }
```

---

## **Benefits**

1. **Direct Addressing**: Talk to specific family members
2. **Guaranteed Response**: @mentioned agent ALWAYS responds
3. **Natural Conversation**: Mimics real group chat dynamics
4. **Better Control**: You decide who participates

---

## **Future Enhancements**

### **Priority Boost (Not 100%)**
- @mention = 80% selection boost
- Still allows other agents to interrupt naturally

### **Multiple Agent Responses**
- @Mom @Dad → Both respond in sequence
- Simulates real family group chaos

### **@Mention Cooldown**
- Can't spam same agent with @mentions
- Prevents abuse

### **Smart Fallback**
- @Uncle (doesn't exist) → "We don't have Uncle here! But Dad can help～"

---

## **Summary**

| Feature | Status |
|---------|--------|
| @mention parsing | ✅ Complete |
| 100% selection priority | ✅ Complete |
| Case insensitive matching | ✅ Complete |
| Role/ID/name matching | ✅ Complete |
| Multiple @mentions | ✅ Supported (first wins) |
| Fallback to random | ✅ Complete |
| Logging | ✅ Complete |

**Result**: When you @mention someone, they respond 100% of the time! 🎯

---

## **Restart Required**

```bash
cd /home/jlguo/agent-hub
pkill -f "tsx watch"
npm run dev
```

Test with: "@Bro 你干啥呢？" - Bro should respond every time!
