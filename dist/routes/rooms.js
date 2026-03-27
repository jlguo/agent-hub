import { Router } from 'express';
import { prisma } from '../index.js';
export const router = Router();
// GET /api/rooms - List all rooms
router.get('/', async (_req, res) => {
    try {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/rooms - Create room
router.post('/', async (req, res) => {
    try {
        const { name, type = 'family', description, context } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Room name is required' });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/rooms/:id - Get room details
router.get('/:id', async (req, res) => {
    try {
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
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json(room);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/rooms/:id - Update room
router.put('/:id', async (req, res) => {
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
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/rooms/:id - Delete room
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.room.delete({
            where: { id },
        });
        res.status(204).send();
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.status(500).json({ error: error.message });
    }
});
// POST /api/rooms/:id/topic - Start a topic discussion
router.post('/:id/topic', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=rooms.js.map