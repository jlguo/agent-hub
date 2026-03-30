# Database Schema Review & Refinement Plan

## 📊 Current ERD Diagram

```mermaid
erDiagram
    Room ||--o{ Agent : "has"
    Room ||--o{ Message : "contains"
    Room ||--o{ Discussion : "has"
    Room ||--o| Session : "tracks"
    
    Agent ||--o{ Message : "sends"
    Agent ||--o{ Relationship : "has as A"
    Agent ||--o{ Relationship : "has as B"
    
    Relationship }|--|| Agent : "connects to"
    
    Discussion ||--o{ Message : "groups"
    
    Room {
        String id PK
        String name
        String type
        String? description
        String? context
        String? externalChatId
        String? openclawSessionId
        Int sessionMaxAge
        DateTime? sessionCreatedAt
        DateTime createdAt
        DateTime updatedAt
    }
    
    Agent {
        String id PK
        String roomId FK
        String name
        String role
        String? avatar
        Int talkativeness (0-100)
        Int empathy (0-100)
        Int curiosity (0-100)
        String? systemPrompt
        Boolean isActive
        Int responseDelay
        DateTime createdAt
        DateTime updatedAt
    }
    
    Relationship {
        String id PK
        String agentAId FK
        String agentBId FK
        String type
        Int strength (0-100)
        String? context
        DateTime createdAt
    }
    
    Message {
        String id PK
        String roomId FK
        String? agentId FK
        String role
        String content
        String? metadata
        DateTime createdAt
    }
    
    Discussion {
        String id PK
        String roomId FK
        String topic
        Int heatScore (0-100)
        String status
        String? participants (JSON)
        DateTime createdAt
        DateTime updatedAt
        DateTime? endedAt
    }
```

---

## 🔍 Current Issues & Limitations

### **CRITICAL Issues**

#### 1. ❌ Message-Discussion Relationship Missing
**Problem**: Messages are NOT linked to Discussions
- Discussion model has no relation to Message
- Cannot track which messages belong to which discussion
- Heat tracking is disconnected from actual messages
- Cannot calculate heat based on message activity

**Impact**: 
- Heat system is manual/broken
- Cannot analyze discussion patterns
- Cannot resume conversations properly

**Fix**: Add `discussionId` to Message model

---

#### 2. ❌ Discussion Heat is Static
**Problem**: `heatScore` is a static field, not calculated
- No automatic heat decay
- No heat increment on messages
- Heat doesn't reflect actual conversation activity

**Impact**:
- Agent selection based on heat doesn't work
- Discussions don't naturally cool down
- No dynamic engagement tracking

**Fix**: Either:
- Add computed heat field (recalculated on message events)
- OR remove heatScore and calculate on-the-fly from message metadata

---

#### 3. ❌ Session Management is Incomplete
**Problem**: Session tracking is in Room model, not separate entity
- No Session model for tracking OpenClaw sessions
- Cannot track multiple sessions per room
- No session history or audit trail
- `openclawSessionId` is just a string field

**Impact**:
- Cannot track session lifecycle
- No session recovery mechanism
- Cannot debug session issues

**Fix**: Create dedicated Session model

---

### **MAJOR Issues**

#### 4. ⚠️ Relationship Model is Redundant
**Problem**: Relationship table stores bidirectional relationships awkwardly
- Requires two entries for bidirectional relationships (parent-of + child-of)
- `@@unique([agentAId, agentBId])` prevents proper bidirectional modeling
- Type field is ambiguous (is it from A→B or B→A?)

**Current Data**:
```
Dad --parent-of--> Child
Child --child-of--> Dad  (redundant!)
```

**Fix**: 
- Make relationships directional with clear semantics
- OR add inverse relationship field
- OR use single entry with bidirectional type

---

#### 5. ⚠️ Agent Traits Use Inconsistent Scales
**Problem**: Database shows mixed scales
- Dad: 70/60/50 (high values)
- Mom: 60/80/60 (high values)
- Others: 5-9 (low values)

**Schema says**: 0-100 scale
**Reality**: Some agents use 0-10, others use 0-100

**Impact**: Agent selection algorithm produces inconsistent results

**Fix**: 
- Enforce 0-100 scale consistently
- OR change to 0-10 scale (more intuitive)
- Add validation constraints

---

#### 6. ⚠️ Message Role Field is Ambiguous
**Problem**: `role` field values are "user" or "assistant"
- But messages can be from Agents OR real users
- "user" could mean "human user" or "any message sender"
- OpenClaw uses same terminology but semantics differ

**Fix**: 
- Change to `messageType: 'human' | 'agent'`
- OR use `senderType: 'human' | 'ai'`
- Remove ambiguity

---

### **MINOR Issues**

#### 7. 💡 External Chat ID is Unique
**Problem**: `externalChatId @unique` prevents same chat from multiple rooms
- Might be intentional, but could limit multi-platform support
- What if same Feishu group connects to multiple rooms?

**Consider**: Remove unique constraint if multi-room support needed

---

#### 8. 💡 Discussion Participants as JSON
**Problem**: `participants` stored as JSON string
- Cannot query participants efficiently
- No foreign key to Agent table
- Data integrity not enforced

**Fix**: Create join table `DiscussionParticipant`

---

#### 9. 💡 Missing Indexes
**Problem**: Limited indexing strategy
- `Message` has index on `[roomId, createdAt]` ✅
- But missing index on `agentId` for agent message queries
- `Discussion` missing index on `heatScore` for hot discussions query

**Fix**: Add strategic indexes based on query patterns

---

#### 10. 💡 No Soft Delete Support
**Problem**: All deletes are CASCADE
- Cannot recover accidentally deleted rooms/agents
- No audit trail for deletions
- Hard to implement "archive" functionality

**Fix**: Add `deletedAt` field for soft deletes

---

## 📋 Recommended Schema Refinements

### **Phase 1: Critical Fixes**

```prisma
// NEW: Session model for tracking OpenClaw sessions
model Session {
  id          String   @id @default(uuid())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  
  sessionId   String   @unique // OpenClaw session ID
  status      String   @default("active") // active, expired, terminated
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
  lastUsedAt  DateTime @updatedAt
  
  @@index([roomId, status])
}

// UPDATED: Message with discussion link
model Message {
  id          String   @id @default(uuid())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  
  agentId     String?  // null if from human
  agent       Agent?   @relation(fields: [agentId], references: [id], onDelete: SetNull)
  
  discussionId String? // NEW: Link to discussion
  discussion  Discussion? @relation(fields: [discussionId], references: [id], onDelete: SetNull)
  
  senderType  String   // NEW: 'human' | 'agent' (replaces role)
  content     String
  
  metadata    String?  // JSON string
  
  createdAt   DateTime @default(now())
  
  @@index([roomId, createdAt])
  @@index([discussionId, createdAt]) // NEW
  @@index([agentId, createdAt])      // NEW
}

// UPDATED: Discussion with proper relations
model Discussion {
  id           String    @id @default(uuid())
  roomId       String
  room         Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  
  topic        String
  heatScore    Int       @default(0) // Calculated field, not stored
  status       String    @default("active") // active, cooling, archived
  
  messages     Message[] // NEW: Messages in this discussion
  
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  archivedAt   DateTime? // Renamed from endedAt
  
  @@index([roomId, status])
  @@index([roomId, createdAt, DESC]) // NEW: For recent discussions
}
```

---

### **Phase 2: Major Improvements**

```prisma
// UPDATED: Agent with consistent trait scale (0-100)
model Agent {
  id            String   @id @default(uuid())
  roomId        String
  room          Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  
  name          String
  role          String
  avatar        String?
  
  // Personality traits (0-100, enforced by application logic)
  talkativeness Int      @default(50)
  empathy       Int      @default(50)
  curiosity     Int      @default(50)
  
  systemPrompt  String?
  isActive      Boolean  @default(true)
  responseDelay Int      @default(1000)
  
  relationshipsAsA Relationship[] @relation("AgentARelationships")
  relationshipsAsB Relationship[] @relation("AgentBRelationships")
  messages       Message[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([roomId, name])
}

// UPDATED: Relationship with clearer semantics
model Relationship {
  id          String @id @default(uuid())
  agentAId    String
  agentBId    String
  agentA      Agent  @relation("AgentARelationships", fields: [agentAId], references: [id], onDelete: Cascade)
  agentB      Agent  @relation("AgentBRelationships", fields: [agentBId], references: [id], onDelete: Cascade)
  
  type        String // Always from A's perspective: "parent-of", "spouse-of", "sibling-of"
  strength    Int    @default(50) // 0-100
  context     String?
  
  createdAt   DateTime @default(now())
  
  @@unique([agentAId, agentBId]) // One relationship per pair
}
```

---

### **Phase 3: Optional Enhancements**

```prisma
// NEW: DiscussionParticipant join table
model DiscussionParticipant {
  id           String     @id @default(uuid())
  discussionId String
  discussion   Discussion @relation(fields: [discussionId], references: [id], onDelete: Cascade)
  agentId      String
  agent        Agent      @relation(fields: [agentId], references: [id], onDelete: Cascade)
  
  joinedAt     DateTime   @default(now())
  messageCount Int        @default(0) // Track participation level
  
  @@unique([discussionId, agentId])
  @@index([agentId])
}

// UPDATED: Room with soft delete
model Room {
  id              String   @id @default(uuid())
  name            String
  type            String   @default("family")
  description     String?
  context         String?
  
  externalChatId  String?  // Removed unique constraint
  deletedAt       DateTime? // NEW: Soft delete
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  agents          Agent[]
  messages        Message[]
  discussions     Discussion[]
  sessions        Session[]
}
```

---

## 🎯 Migration Strategy

### **Step 1: Add Discussion Link to Messages**
```sql
-- Add discussionId column
ALTER TABLE Message ADD COLUMN discussionId TEXT;

-- Create index
CREATE INDEX Message_discussionId_createdAt ON Message(discussionId, createdAt);

-- Update existing messages (assign to most recent discussion or NULL)
-- This requires application logic
```

### **Step 2: Create Session Table**
```sql
CREATE TABLE Session (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL,
  sessionId TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME,
  lastUsedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roomId) REFERENCES Room(id) ON DELETE CASCADE
);

CREATE INDEX Session_roomId_status ON Session(roomId, status);
```

### **Step 3: Update Message.role to Message.senderType**
```sql
-- Add new column
ALTER TABLE Message ADD COLUMN senderType TEXT;

-- Migrate data
UPDATE Message SET senderType = CASE 
  WHEN role = 'user' THEN 'human'
  WHEN role = 'assistant' THEN 'agent'
END;

-- Drop old column, rename new (or keep both during transition)
```

### **Step 4: Normalize Agent Traits**
```sql
-- Check current distribution
SELECT name, talkativeness, empathy, curiosity FROM Agent;

-- If values are 0-10, scale to 0-100
UPDATE Agent SET 
  talkativeness = talkativeness * 10,
  empathy = empathy * 10,
  curiosity = curiosity * 10
WHERE talkativeness <= 10 AND empathy <= 10 AND curiosity <= 10;
```

---

## 📊 Query Patterns & Index Optimization

### **Common Queries**

1. **Get recent messages for room**
```sql
SELECT * FROM Message 
WHERE roomId = ? 
ORDER BY createdAt DESC 
LIMIT 50;
-- Index: [roomId, createdAt DESC] ✅ Already exists
```

2. **Get messages for discussion**
```sql
SELECT * FROM Message 
WHERE discussionId = ? 
ORDER BY createdAt ASC;
-- Index: [discussionId, createdAt] ✅ Added in Phase 1
```

3. **Get active agents in room**
```sql
SELECT * FROM Agent 
WHERE roomId = ? AND isActive = true;
-- Index: [roomId, isActive] - Consider adding
```

4. **Get hot discussions**
```sql
SELECT * FROM Discussion 
WHERE roomId = ? AND status = 'active'
ORDER BY heatScore DESC, createdAt DESC;
-- Index: [roomId, status, heatScore DESC] - Consider adding
```

5. **Get agent relationships**
```sql
SELECT * FROM Relationship 
WHERE agentAId = ? OR agentBId = ?;
-- Index: [agentAId], [agentBId] - Consider adding composite
```

---

## ✅ Recommended Action Plan

### **Immediate (This Week)**
1. ✅ Add `discussionId` to Message model
2. ✅ Create Session model
3. ✅ Change `role` to `senderType`
4. ✅ Normalize agent trait values (0-100 scale)

### **Short-term (Next Week)**
5. Add DiscussionParticipant join table
6. Add soft delete support
7. Add missing indexes
8. Update agent selection algorithm to use new schema

### **Long-term (Future)**
9. Remove unique constraint from externalChatId
10. Add message reactions/emoji support
11. Add conversation summaries/caching
12. Add full-text search for message content

---

## 🎓 Design Principles Applied

1. **Single Source of Truth**: Each fact stored once
2. **Referential Integrity**: Foreign keys with proper cascades
3. **Query Performance**: Indexes match query patterns
4. **Flexibility**: JSON for extensible metadata
5. **Audit Trail**: Timestamps on all entities
6. **Soft Deletes**: Preserve data for recovery
7. **Clear Semantics**: Unambiguous field names

---

## 🤔 Open Questions for Review

1. **Discussion-Message Relationship**: Should every message belong to a discussion, or only topic-related messages?
2. **Heat Calculation**: Store calculated heat or compute on-the-fly?
3. **Session Lifecycle**: Should sessions auto-expire or be manually terminated?
4. **Multi-platform**: Do we need to support same room across multiple chat platforms?
5. **Agent Memory**: Should we store long-term memory per agent (separate from messages)?

---

**Next Steps**: Review this document, discuss open questions, then implement Phase 1 changes.
