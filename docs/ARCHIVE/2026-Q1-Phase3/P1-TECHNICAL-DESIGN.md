# P1 User Experience - Technical Design

**Date**: 2026-04-01  
**Phase**: Phase 3 (Polish & Production)  
**Priority**: P1 (Important)  
**Estimated Effort**: 18-24 hours total

---

## Overview

P1 focuses on enhancing user experience with three key features:

1. **Typing Indicators** - Real-time "agent is typing" status during response generation
2. **Message Read Receipts** - Track and display message read status
3. **Admin Dashboard** - Management interface for rooms, agents, and system monitoring

---

## 1. Typing Indicators

### 1.1 User Experience Flow

```
User sends message
    ↓
Agent selected (Mom)
    ↓
[IMMEDIATE] Typing indicator appears: "Mom is typing..."
    ↓
OpenClaw CLI executes (10-60s)
    ↓
Response generated
    ↓
Typing indicator disappears
    ↓
Agent message appears in chat
```

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────┤
│  Chat UI Component                                       │
│  ├─ Message List                                         │
│  │   └─ Typing Indicator Component                       │
│  │       ├─ Agent avatar                                 │
│  │       ├─ "Agent is typing..." text                    │
│  │       └─ Animated dots (...)                          │
│  └─ WebSocket Listener                                   │
│      └─ Listens for: typing:start, typing:stop           │
└─────────────────────────────────────────────────────────┘
         ▲
         │ WebSocket (Socket.io)
         │ Events: typing:start, typing:stop
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend (Express)                      │
├─────────────────────────────────────────────────────────┤
│  MessageService.ts                                       │
│  ├─ triggerAgentResponse()                               │
│  │   ├─ Select agent                                     │
│  │   ├─ Emit typing:start                                │
│  │   ├─ Call OpenClaw CLI (async)                        │
│  │   └─ Emit typing:stop + message:new                   │
│  └─ WebSocket IO                                         │
│      └─ Broadcast to room: io.to(roomId).emit()          │
└─────────────────────────────────────────────────────────┘
```

### 1.3 WebSocket Events

#### Event: `typing:start`

```typescript
// Server emits when agent starts generating response
io.to(roomId).emit('typing:start', {
  agentId: 'family-mom',
  agentName: 'Mom',
  agentAvatar: '👩',
  timestamp: '2026-04-01T11:00:00.000Z',
  estimatedDuration: 30000, // 30s estimate based on avg response time
});
```

#### Event: `typing:stop`

```typescript
// Server emits when agent response is ready
io.to(roomId).emit('typing:stop', {
  agentId: 'family-mom',
  agentName: 'Mom',
  timestamp: '2026-04-01T11:00:30.000Z',
  duration: 30000, // Actual duration in ms
});
```

### 1.4 Frontend Component

**File**: `client/app/components/TypingIndicator.tsx`

```typescript
interface TypingIndicatorProps {
  agentName: string;
  agentAvatar: string;
  isVisible: boolean;
  duration?: number; // For progress bar
}

export function TypingIndicator({
  agentName,
  agentAvatar,
  isVisible,
  duration
}: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg animate-fade-in">
      <div className="text-2xl">{agentAvatar}</div>
      <div className="flex-1">
        <div className="text-sm text-gray-600">
          {agentName} is typing
          <span className="animate-pulse">...</span>
        </div>
        {/* Optional: Progress bar for long responses */}
        {duration && duration > 20000 && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full animate-progress"
              style={{
                animationDuration: `${Math.min(duration, 120000)}ms`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

### 1.5 Backend Implementation

**File**: `server/src/services/MessageService.ts`

```typescript
async function triggerAgentResponse(roomId: string, message: string, discussionId: string) {
  // 1. Select agent
  const agent = await agentSelector.selectAgents(roomId, message, discussionId);
  if (!agent || agent.length === 0) return;

  const selectedAgent = agent[0];

  // 2. Emit typing:start IMMEDIATELY
  const io = getIO();
  io.to(roomId).emit('typing:start', {
    agentId: selectedAgent.id,
    agentName: selectedAgent.name,
    agentAvatar: selectedAgent.avatar,
    timestamp: new Date().toISOString(),
    estimatedDuration: 30000, // Default 30s estimate
  });

  const startTime = Date.now();

  try {
    // 3. Generate response (this takes 10-60s)
    const response = await openclawService.sendMessage(
      selectedAgent.id,
      roomId,
      selectedAgent.name,
      message
    );

    const duration = Date.now() - startTime;

    // 4. Save agent message to DB
    const agentMessage = await prisma.message.create({
      data: {
        roomId,
        discussionId,
        senderType: 'agent',
        agentId: selectedAgent.id,
        content: response.text,
        metadata: {
          generationTime: duration,
          model: response.model,
        },
      },
      include: { agent: true },
    });

    // 5. Emit typing:stop
    io.to(roomId).emit('typing:stop', {
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      timestamp: new Date().toISOString(),
      duration,
    });

    // 6. Emit message:new (the actual response)
    io.to(roomId).emit('message:new', {
      ...agentMessage,
      agentName: agentMessage.agent?.name,
      agentAvatar: agentMessage.agent?.avatar,
    });
  } catch (error) {
    // 7. Handle error - emit typing:stop anyway
    io.to(roomId).emit('typing:stop', {
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      timestamp: new Date().toISOString(),
      error: true,
    });

    throw error;
  }
}
```

### 1.6 Multiple Agents Typing

When multiple agents are triggered (e.g., @Mom @Dad), show multiple typing indicators:

```typescript
// Frontend state
const [typingAgents, setTypingAgents] = useState<Map<string, TypingAgent>>(new Map());

// On typing:start
socket.on('typing:start', (data) => {
  setTypingAgents(prev => new Map(prev).set(data.agentId, data));
});

// On typing:stop
socket.on('typing:stop', (data) => {
  setTypingAgents(prev => {
    const next = new Map(prev);
    next.delete(data.agentId);
    return next;
  });
});

// Render all typing indicators
{Array.from(typingAgents.values()).map(agent => (
  <TypingIndicator
    key={agent.agentId}
    agentName={agent.agentName}
    agentAvatar={agent.agentAvatar}
    isVisible={true}
  />
))}
```

---

## 2. Message Read Receipts

### 2.1 Database Schema Changes

**File**: `prisma/schema.prisma`

```prisma
model Message {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])

  // Existing fields
  senderType String  // 'human' | 'agent' | 'system'
  agentId    String?
  agent      Agent?  @relation(fields: [agentId], references: [id])
  content    String
  createdAt  DateTime @default(now())

  // NEW: Read receipts
  readBy     MessageRead[]

  // Existing relations
  discussionId String?
  discussion   Discussion? @relation(fields: [discussionId], references: [id])
}

// NEW model
model MessageRead {
  id        String   @id @default(cuid())
  messageId String
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId    String   // Feishu user ID or session ID
  readAt    DateTime @default(now())

  @@unique([messageId, userId]) // One read record per user per message
  @@index([userId, readAt])
}

// NEW: Track last read timestamp per user per room
model UserRoomRead {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
  userId    String
  lastReadAt DateTime @default(now())

  @@unique([roomId, userId]) // One record per user per room
  @@index([roomId, userId])
}
```

### 2.2 Read Receipt Flow

```
User opens room/focuses chat
    ↓
Frontend: Get lastReadAt for this user+room
    ↓
Frontend: Query messages where createdAt > lastReadAt
    ↓
Frontend: Send "mark as read" for unread messages
    ↓
Backend: Create MessageRead records
    ↓
Backend: Update UserRoomRead.lastReadAt = now()
    ↓
Backend: Emit read:update to other users in room
    ↓
Other users see: "User123 read 5 messages"
```

### 2.3 API Endpoints

#### GET `/api/messages/rooms/:roomId/unread-count`

```typescript
// Get count of unread messages for current user
GET /api/messages/rooms/family-room-demo/unread-count
Authorization: Bearer <token> or X-User-ID: <userId>

Response: 200 OK
{
  "roomId": "family-room-demo",
  "userId": "ou_b525c9f2d700b31f507260bd0dd6d477",
  "unreadCount": 5,
  "lastReadAt": "2026-04-01T10:30:00.000Z",
  "latestMessageAt": "2026-04-01T11:00:00.000Z"
}
```

#### POST `/api/messages/rooms/:roomId/read`

```typescript
// Mark messages as read
POST /api/messages/rooms/family-room-demo/read
Authorization: Bearer <token> or X-User-ID: <userId>
Body: {
  "upTo": "2026-04-01T11:00:00.000Z" // Mark all messages before this as read
}

Response: 200 OK
{
  "markedRead": 5,
  "lastReadAt": "2026-04-01T11:00:00.000Z"
}
```

#### WebSocket Event: `read:update`

```typescript
// Server emits when user reads messages
io.to(roomId).emit('read:update', {
  userId: 'ou_b525c9f2d700b31f507260bd0dd6d477',
  userName: 'user951367',
  readCount: 5,
  timestamp: '2026-04-01T11:00:00.000Z',
});
```

### 2.4 Frontend Implementation

**File**: `client/app/hooks/useReadReceipts.ts`

```typescript
export function useReadReceipts(roomId: string, userId: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);
  const socket = useSocket();

  // Load initial unread count
  useEffect(() => {
    async function loadUnread() {
      const res = await fetch(`/api/messages/rooms/${roomId}/unread-count`, {
        headers: { 'X-User-ID': userId },
      });
      const data = await res.json();
      setUnreadCount(data.unreadCount);
      setLastReadAt(new Date(data.lastReadAt));
    }
    loadUnread();
  }, [roomId, userId]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    socket.on('message:new', (message) => {
      // If message is from current user or after last read, increment
      if (
        message.senderId !== userId &&
        (!lastReadAt || new Date(message.createdAt) > lastReadAt)
      ) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // Listen for other users' read updates
    socket.on('read:update', (data) => {
      console.log(`${data.userName} read ${data.readCount} messages`);
    });

    return () => {
      socket.off('message:new');
      socket.off('read:update');
    };
  }, [socket, userId, lastReadAt]);

  // Mark messages as read
  const markAsRead = useCallback(
    async (upTo: Date = new Date()) => {
      if (unreadCount === 0) return;

      await fetch(`/api/messages/rooms/${roomId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({ upTo: upTo.toISOString() }),
      });

      setUnreadCount(0);
      setLastReadAt(upTo);

      // Emit to other users
      socket?.emit('read:update', {
        roomId,
        userId,
        readCount: unreadCount,
        timestamp: upTo.toISOString(),
      });
    },
    [roomId, userId, unreadCount, socket]
  );

  // Auto-mark as read when user focuses window
  useEffect(() => {
    const handleFocus = () => markAsRead();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [markAsRead]);

  return { unreadCount, lastReadAt, markAsRead };
}
```

### 2.5 UI Components

**File**: `client/app/components/UnreadBadge.tsx`

```typescript
interface UnreadBadgeProps {
  count: number;
}

export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count === 0) return null;

  return (
    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
      {count > 99 ? '99+' : count}
    </div>
  );
}
```

**File**: `client/app/components/RoomList.tsx` (with unread badges)

```typescript
{rooms.map(room => (
  <div key={room.id} className="relative">
    <button onClick={() => selectRoom(room.id)}>
      {room.name}
    </button>
    <UnreadBadge count={room.unreadCount[room.id] || 0} />
  </div>
))}
```

**File**: `client/app/components/ChatFooter.tsx` (show read status)

```typescript
<div className="text-xs text-gray-500 mt-2">
  {messages.length > 0 && (
    <div>
      {messages[messages.length - 1].readBy?.length || 0} read
      {messages[messages.length - 1].readBy?.some(r => r.userId === currentUserId) && (
        <span className="ml-1">✓ You read this</span>
      )}
    </div>
  )}
</div>
```

---

## 3. Admin Dashboard

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Admin Dashboard (Next.js App Router)        │
├─────────────────────────────────────────────────────────┤
│  /admin                                                 │
│  ├── /dashboard          # System health overview       │
│  ├── /rooms              # Room management              │
│  │   ├── [id]            # Room details                 │
│  │   └── create          # Create new room              │
│  ├── /agents             # Agent management             │
│  │   ├── [id]            # Agent details/edit           │
│  │   └── create          # Create new agent             │
│  ├── /users              # User management              │
│  ├── /discussions        # Discussion history           │
│  └── /settings           # System configuration         │
└─────────────────────────────────────────────────────────┘
         │
         │ HTTP + WebSocket
         ▼
┌─────────────────────────────────────────────────────────┐
│                  Admin API Routes                        │
├─────────────────────────────────────────────────────────┤
│  /api/admin/                                             │
│  ├── /stats              # System statistics            │
│  ├── /rooms              # CRUD for rooms               │
│  ├── /agents             # CRUD for agents              │
│  ├── /users              # User list + actions          │
│  ├── /discussions        # Discussion list + details    │
│  └── /config             # System configuration         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Dashboard Page

**File**: `client/app/admin/dashboard/page.tsx`

```typescript
export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data);
    }
    loadStats();

    // Refresh every 30s
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">System Dashboard</h1>

      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <HealthCard
          title="Backend"
          status={stats.health.backend ? 'healthy' : 'down'}
          latency={stats.health.backendLatency}
        />
        <HealthCard
          title="Database"
          status={stats.health.database ? 'healthy' : 'down'}
          latency={stats.health.databaseLatency}
        />
        <HealthCard
          title="Feishu"
          status={stats.health.feishu ? 'healthy' : 'down'}
          latency={stats.health.feishuLatency}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Rooms" value={stats.rooms.total} />
        <MetricCard title="Active Rooms" value={stats.rooms.active} />
        <MetricCard title="Total Agents" value={stats.agents.total} />
        <MetricCard title="Active Agents" value={stats.agents.active} />
        <MetricCard title="Messages (24h)" value={stats.messages.last24h} />
        <MetricCard title="Discussions (24h)" value={stats.discussions.last24h} />
        <MetricCard title="Avg Response Time" value={`${stats.metrics.avgResponseTime}s`} />
        <MetricCard title="WebSocket Clients" value={stats.metrics.websocketClients} />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <ActivityLog events={stats.recentActivity} />
      </div>
    </div>
  );
}
```

### 3.3 Room Management

**File**: `client/app/admin/rooms/page.tsx`

```typescript
export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRooms() {
      const res = await fetch('/api/admin/rooms');
      const data = await res.json();
      setRooms(data);
      setLoading(false);
    }
    loadRooms();
  }, []);

  const deleteRoom = async (roomId: string) => {
    if (!confirm('Delete this room? This cannot be undone.')) return;

    await fetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
    setRooms(rooms.filter(r => r.id !== roomId));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <Link href="/admin/rooms/create" className="btn-primary">
          + New Room
        </Link>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">External Chat ID</th>
            <th className="text-left py-2">Agents</th>
            <th className="text-left py-2">Messages</th>
            <th className="text-left py-2">Created</th>
            <th className="text-left py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map(room => (
            <tr key={room.id} className="border-b hover:bg-gray-50">
              <td className="py-3">{room.name}</td>
              <td className="py-3 font-mono text-sm">{room.externalChatId || 'N/A'}</td>
              <td className="py-3">{room._count.agents}</td>
              <td className="py-3">{room._count.messages}</td>
              <td className="py-3 text-sm text-gray-500">
                {new Date(room.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3">
                <Link href={`/admin/rooms/${room.id}`} className="text-blue-600 mr-3">
                  Edit
                </Link>
                <button
                  onClick={() => deleteRoom(room.id)}
                  className="text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3.4 Agent Management

**File**: `client/app/admin/agents/[id]/page.tsx`

```typescript
export default function EditAgentPage({ params }: { params: { id: string } }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    avatar: '',
    talkativeness: 50,
    empathy: 50,
    curiosity: 50
  });

  useEffect(() => {
    async function loadAgent() {
      const res = await fetch(`/api/admin/agents/${params.id}`);
      const data = await res.json();
      setAgent(data);
      setFormData({
        name: data.name,
        role: data.role,
        avatar: data.avatar,
        talkativeness: data.talkativeness,
        empathy: data.empathy,
        curiosity: data.curiosity
      });
    }
    loadAgent();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/admin/agents/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    alert('Agent updated successfully!');
  };

  if (!agent) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Edit Agent: {agent.name}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <input
            type="text"
            value={formData.role}
            onChange={e => setFormData({...formData, role: e.target.value})}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., father, mother, sister"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Avatar Emoji</label>
          <input
            type="text"
            value={formData.avatar}
            onChange={e => setFormData({...formData, avatar: e.target.value})}
            className="w-full border rounded px-3 py-2"
            placeholder="👨"
            maxLength={2}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Talkativeness: {formData.talkativeness}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.talkativeness}
              onChange={e => setFormData({...formData, talkativeness: parseInt(e.target.value)})}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Empathy: {formData.empathy}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.empathy}
              onChange={e => setFormData({...formData, empathy: parseInt(e.target.value)})}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Curiosity: {formData.curiosity}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.curiosity}
              onChange={e => setFormData({...formData, curiosity: parseInt(e.target.value)})}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button type="submit" className="btn-primary">
            Save Changes
          </button>
          <Link href="/admin/agents" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>

      {/* Agent Relationships */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Relationships</h2>
        <RelationshipEditor agentId={params.id} />
      </div>
    </div>
  );
}
```

### 3.5 API Routes

**File**: `server/src/routes/admin.ts`

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All admin routes require authentication
router.use(authMiddleware);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const [rooms, agents, messages24h, discussions24h, health] = await Promise.all([
    prisma.room.findMany({ include: { _count: { select: { agents: true, messages: true } } } }),
    prisma.agent.findMany({ include: { _count: { select: { messages: true } } } }),
    prisma.message.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.discussion.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    getHealthStatus(), // Custom health check function
  ]);

  res.json({
    rooms: {
      total: rooms.length,
      active: rooms.filter((r) => r.settings).length,
    },
    agents: {
      total: agents.length,
      active: agents.filter((a) => a.talkativeness > 0).length,
    },
    messages: { last24h: messages24h },
    discussions: { last24h: discussions24h },
    health,
    metrics: {
      avgResponseTime: await getAverageResponseTime(),
      websocketClients: getIO()?.engine?.clientsCount || 0,
    },
    recentActivity: await getRecentActivity(10),
  });
});

// GET /api/admin/rooms
router.get('/rooms', async (req, res) => {
  const rooms = await prisma.room.findMany({
    include: {
      _count: {
        select: {
          agents: true,
          messages: true,
          discussions: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rooms);
});

// DELETE /api/admin/rooms/:id
router.delete('/rooms/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.room.delete({
    where: { id },
    include: {
      agents: true,
      messages: true,
      discussions: true,
    },
  });
  res.json({ success: true });
});

// GET /api/admin/agents/:id
router.get('/agents/:id', async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.id },
    include: {
      relationshipsAsA: true,
      relationshipsAsB: true,
      _count: {
        select: { messages: true },
      },
    },
  });
  res.json(agent);
});

// PUT /api/admin/agents/:id
router.put('/agents/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, avatar, talkativeness, empathy, curiosity } = req.body;

  const agent = await prisma.agent.update({
    where: { id },
    data: {
      name,
      role,
      avatar,
      talkativeness,
      empathy,
      curiosity,
    },
  });

  res.json(agent);
});

export default router;
```

---

## 4. Implementation Plan

### Week 1: Typing Indicators (6-8 hours)

**Day 1**: Backend WebSocket Events (3-4 hours)

- Add `typing:start` and `typing:stop` events to MessageService.ts
- Test WebSocket event emission
- Handle multiple agents typing simultaneously
- **Deliverable**: Typing events working in backend

**Day 2**: Frontend Typing Component (3-4 hours)

- Create TypingIndicator component
- Add WebSocket listeners for typing events
- Integrate into chat UI
- Add animation for typing dots
- **Deliverable**: Typing indicators visible in UI

### Week 2: Read Receipts (6-8 hours)

**Day 1-2**: Database + API (4 hours)

- Add MessageRead and UserRoomRead models to schema
- Run Prisma migration
- Create API endpoints (unread-count, mark-as-read)
- **Deliverable**: API endpoints working

**Day 3-4**: Frontend Integration (4 hours)

- Create useReadReceipts hook
- Add UnreadBadge component
- Integrate into RoomList and ChatFooter
- Test auto-mark as read on focus
- **Deliverable**: Read receipts working end-to-end

### Week 3: Admin Dashboard (6-8 hours)

**Day 1-2**: Dashboard Layout + Stats (4 hours)

- Create /admin route structure
- Build dashboard page with metrics cards
- Add health status cards
- Create /api/admin/stats endpoint
- **Deliverable**: Dashboard showing system stats

**Day 3-4**: Room + Agent Management (4 hours)

- Build room list + CRUD operations
- Build agent edit page with trait sliders
- Add relationship editor
- Test all CRUD operations
- **Deliverable**: Full room/agent management UI

---

## 5. Success Criteria

### Typing Indicators ✅

- [ ] Typing indicator appears immediately when agent starts generating
- [ ] Shows agent name and avatar
- [ ] Disappears when response is ready
- [ ] Handles multiple agents typing simultaneously
- [ ] Includes progress bar for long responses (>20s)
- [ ] Works on both Web UI and Feishu (text status)

### Read Receipts ✅

- [ ] Unread count badge shows on rooms with unread messages
- [ ] Messages auto-mark as read when user focuses chat
- [ ] Read status syncs across devices via WebSocket
- [ ] Shows "X messages read" in chat footer
- [ ] API returns accurate unread counts
- [ ] Database indexes optimize read queries

### Admin Dashboard ✅

- [ ] Dashboard shows real-time system health
- [ ] Room list with message/agent counts
- [ ] Create/edit/delete rooms
- [ ] Edit agent personality traits (sliders)
- [ ] View agent relationships
- [ ] Protected by authentication (JWT)
- [ ] Responsive design (mobile-friendly)

---

## 6. Database Migration

**File**: `prisma/migrations/20260401_add_read_receipts/migration.sql`

```sql
-- CreateTable
CREATE TABLE "MessageRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRoomRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRoomRead_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageRead_messageId_userId_key" ON "MessageRead"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MessageRead_userId_readAt_idx" ON "MessageRead"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoomRead_roomId_userId_key" ON "UserRoomRead"("roomId", "userId");

-- CreateIndex
CREATE INDEX "UserRoomRead_roomId_userId_idx" ON "UserRoomRead"("roomId", "userId");
```

---

## 7. Risks & Mitigations

| Risk                                    | Impact | Likelihood | Mitigation                                    |
| --------------------------------------- | ------ | ---------- | --------------------------------------------- |
| Typing indicators spam (flickering)     | Medium | Medium     | Debounce typing events, minimum 2s display    |
| Read receipts performance (large rooms) | High   | Medium     | Pagination, batch updates, indexed queries    |
| Admin dashboard exposes sensitive data  | High   | Low        | JWT authentication, role-based access control |
| WebSocket overload (many users reading) | Medium | Low        | Throttle read:update events, batch updates    |
| Database bloat (MessageRead table)      | Medium | Medium     | Archive old reads, cleanup job monthly        |

---

## 8. Future Enhancements (P2/P3)

### Typing Indicators

- **Custom messages**: "Mom is thinking about dinner..."
- **Typing speed indicator**: Fast/slow based on actual typing
- **Agent mood**: Different animations for different agents

### Read Receipts

- **Per-message read status**: Show which users read each message
- **Read timestamps**: "Read at 11:30 AM"
- **Read receipts for Feishu**: Sync with Feishu read status

### Admin Dashboard

- **Analytics charts**: Message volume over time, heat trends
- **User management**: Ban/mute users, view user history
- **Discussion viewer**: Browse all discussions with filters
- **System logs**: View application logs in UI
- **Backup/restore**: Database backup and restore functionality

---

## 9. Files to Create/Modify

### Backend

```
server/src/
├── routes/
│   └── admin.ts                    # NEW: Admin API routes
├── services/
│   └── MessageService.ts           # MODIFY: Add typing events
├── middleware/
│   └── auth.ts                     # NEW: JWT authentication
└── lib/
    └── health.ts                   # NEW: Health check utilities
```

### Frontend

```
client/app/
├── admin/
│   ├── dashboard/
│   │   └── page.tsx                # NEW: System dashboard
│   ├── rooms/
│   │   ├── page.tsx                # NEW: Room list
│   │   ├── create/
│   │   │   └── page.tsx            # NEW: Create room
│   │   └── [id]/
│   │       └── page.tsx            # NEW: Edit room
│   ├── agents/
│   │   ├── page.tsx                # NEW: Agent list
│   │   └── [id]/
│   │       └── page.tsx            # NEW: Edit agent
│   └── layout.tsx                  # NEW: Admin layout
├── components/
│   ├── TypingIndicator.tsx         # NEW: Typing indicator
│   ├── UnreadBadge.tsx             # NEW: Unread count badge
│   └── ChatFooter.tsx              # MODIFY: Add read status
└── hooks/
    └── useReadReceipts.ts          # NEW: Read receipts hook
```

### Database

```
prisma/
├── schema.prisma                   # MODIFY: Add MessageRead, UserRoomRead
└── migrations/
    └── 20260401_add_read_receipts/
        └── migration.sql           # NEW: Migration script
```

---

## 10. Next Steps

1. **Review this design** with stakeholders
2. **Prioritize features**:
   - Typing Indicators (quickest win, high visibility)
   - Read Receipts (medium effort, good UX)
   - Admin Dashboard (most effort, most powerful)
3. **Start implementation** with Week 1 (Typing Indicators)
4. **Test thoroughly** before deploying to production

---

**Ready to implement?** I recommend starting with **Typing Indicators** as it's the quickest to implement and provides immediate visual feedback to users, making the system feel more responsive and alive.

Which feature would you like to build first? 🚀
