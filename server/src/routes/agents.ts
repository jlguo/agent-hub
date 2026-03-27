import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';

export const router = Router();

// GET /api/agents - List all agents (across all rooms)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        room: true,
        relationshipsAsA: true,
        relationshipsAsB: true,
      },
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rooms/:roomId/agents - List agents in a room
router.get('/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const agents = await prisma.agent.findMany({
      where: { roomId },
      include: {
        relationshipsAsA: true,
        relationshipsAsB: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rooms/:roomId/agents - Create agent
router.post('/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const {
      name,
      role,
      avatar,
      talkativeness = 50,
      empathy = 50,
      curiosity = 50,
      systemPrompt,
      responseDelay = 1000,
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const agent = await prisma.agent.create({
      data: {
        roomId,
        name,
        role,
        avatar,
        talkativeness,
        empathy,
        curiosity,
        systemPrompt,
        responseDelay,
      },
      include: {
        room: true,
      },
    });

    // Emit WebSocket event
    const { io } = await import('../index.js');
    io.to(roomId).emit('agent:created', { agent });

    res.status(201).json(agent);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Agent with this name already exists in the room' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rooms/:roomId/agents/:id - Get agent details
router.get('/rooms/:roomId/:id', async (req: Request, res: Response) => {
  try {
    const { roomId, id } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        room: true,
        relationshipsAsA: true,
        relationshipsAsB: true,
      },
    });

    if (!agent || agent.roomId !== roomId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/rooms/:roomId/agents/:id - Update agent
router.put('/rooms/:roomId/:id', async (req: Request, res: Response) => {
  try {
    const { roomId, id } = req.params;
    const {
      name,
      role,
      avatar,
      talkativeness,
      empathy,
      curiosity,
      systemPrompt,
      isActive,
      responseDelay,
    } = req.body;

    const agent = await prisma.agent.update({
      where: { id, roomId },
      data: {
        name,
        role,
        avatar,
        talkativeness,
        empathy,
        curiosity,
        systemPrompt,
        isActive,
        responseDelay,
      },
      include: {
        room: true,
      },
    });

    // Emit WebSocket event
    const { io } = await import('../index.js');
    io.to(roomId).emit('agent:updated', { agent });

    res.json(agent);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Agent with this name already exists in the room' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/rooms/:roomId/agents/:id - Delete agent
router.delete('/rooms/:roomId/:id', async (req: Request, res: Response) => {
  try {
    const { roomId, id } = req.params;

    await prisma.agent.delete({
      where: { id, roomId },
    });

    // Emit WebSocket event
    const { io } = await import('../index.js');
    io.to(roomId).emit('agent:deleted', { agentId: id });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rooms/:roomId/agents/:agentId/relationships - Add relationship
router.post('/rooms/:roomId/agents/:agentId/relationships', async (req: Request, res: Response) => {
  try {
    const { roomId, agentId } = req.params;
    const { otherAgentId, type, strength = 50, context } = req.body;

    if (!otherAgentId || !type) {
      return res.status(400).json({ error: 'otherAgentId and type are required' });
    }

    // Verify both agents exist in the room
    const [agent1, agent2] = await Promise.all([
      prisma.agent.findUnique({ where: { id: agentId } }),
      prisma.agent.findUnique({ where: { id: otherAgentId } }),
    ]);

    if (!agent1 || !agent2) {
      return res.status(404).json({ error: 'One or both agents not found' });
    }

    if (agent1.roomId !== roomId || agent2.roomId !== roomId) {
      return res.status(400).json({ error: 'Both agents must be in the same room' });
    }

    const relationship = await prisma.relationship.create({
      data: {
        agentAId: agentId,
        agentBId: otherAgentId,
        type,
        strength,
        context,
      },
      include: {
        agentA: true,
        agentB: true,
      },
    });

    // Emit WebSocket event
    const { io } = await import('../index.js');
    io.to(roomId).emit('relationship:created', { relationship });

    res.status(201).json(relationship);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Relationship already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});
