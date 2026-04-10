import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

export const router = Router();

// GET /api/rooms - List all rooms
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const rooms = await prisma.room.findMany({
      include: {
        agents: {
          where: { isActive: true },
        },
        _count: {
          select: { messages: true, discussions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(rooms);
  })
);

// POST /api/rooms - Create room
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, type = 'family', description, context } = req.body;

    if (!name) {
      throw ApiError.badRequest('Room name is required');
    }

    const room = await prisma.room.create({
      data: {
        name,
        type,
        description,
        context,
      },
      include: { agents: true },
    });

    res.status(201).json(room);
  })
);

// GET /api/rooms/:id - Get room details
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        agents: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        discussions: {
          where: { status: 'active' },
        },
      },
    });

    if (!room) {
      throw ApiError.notFound('Room');
    }

    res.json(room);
  })
);

// PUT /api/rooms/:id - Update room
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, description, context } = req.body;

    const room = await prisma.room.update({
      where: { id },
      data: {
        name,
        type,
        description,
        context,
      },
      include: { agents: true },
    });

    res.json(room);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/rooms/:id - Delete room
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.room.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rooms/:id/topic - Start a topic discussion
router.post('/:id/topic', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const discussion = await prisma.discussion.create({
      data: {
        roomId: id,
        topic,
        heatScore: 100,
        status: 'active',
      },
    });

    // Emit WebSocket event
    const { io } = await import('../index.js');
    io.to(id).emit('discussion:started', { discussion });

    res.status(201).json(discussion);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
