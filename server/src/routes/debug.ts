import { Router } from 'express';
import { prisma } from '../index.js';
import { getIO } from '../websocket/index.js';

const router = Router();

/**
 * Debug endpoints for testing - NOT for production use
 * These endpoints bypass normal business logic for test control
 */

/**
 * Set discussion heat level directly
 * Useful for E2E tests to ensure deterministic agent responses
 */
router.post('/set-heat', async (req, res) => {
  try {
    const { roomId, heat, discussionId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }

    if (heat === undefined || heat < 0 || heat > 100) {
      return res.status(400).json({ error: 'heat must be between 0 and 100' });
    }

    // Find or create discussion
    let discussion;
    if (discussionId) {
      discussion = await prisma.discussion.findUnique({
        where: { id: discussionId },
      });
    }

    if (!discussion) {
      // Get or create room
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { discussions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      discussion = room.discussions[0];
    }

    if (!discussion) {
      // Create a new discussion
      discussion = await prisma.discussion.create({
        data: {
          roomId,
          topic: 'Test discussion',
          heatScore: heat,
          status: 'active',
        },
      });
    } else {
      // Update existing discussion heat
      discussion = await prisma.discussion.update({
        where: { id: discussion.id },
        data: { heatScore: heat, status: 'active' },
      });
    }

    // Update heat tracker cache (if it exists)
    // Note: This is a best-effort update, the heat tracker will sync on next cycle

    res.json({
      success: true,
      discussionId: discussion.id,
      heat,
      message: `Heat set to ${heat} for discussion ${discussion.id}`,
    });
  } catch (error) {
    console.error('[DebugRoute] Error setting heat:', error);
    res.status(500).json({
      error: 'Failed to set heat',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Reset database to clean state
 * Useful for E2E tests to ensure consistent starting point
 */
router.post('/reset-database', async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'YES_DELETE_ALL_DATA') {
      return res.status(400).json({
        error: 'Must confirm with confirm: "YES_DELETE_ALL_DATA"',
      });
    }

    // Delete in order to respect foreign keys
    await prisma.message.deleteMany({});
    await prisma.discussion.deleteMany({});
    await prisma.relationship.deleteMany({});
    await prisma.agent.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.session.deleteMany({});

    res.json({
      success: true,
      message: 'Database reset complete - all data deleted',
    });
  } catch (error) {
    console.error('[DebugRoute] Error resetting database:', error);
    res.status(500).json({
      error: 'Failed to reset database',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Seed database with test data
 */
router.post('/seed', async (req, res) => {
  try {
    // Import seed script dynamically
    const { seedDatabase } = await import('../test/database.js');
    await seedDatabase();

    res.json({
      success: true,
      message: 'Database seeded with test data',
    });
  } catch (error) {
    console.error('[DebugRoute] Error seeding database:', error);
    res.status(500).json({
      error: 'Failed to seed database',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get current system status
 */
router.get('/status', async (req, res) => {
  try {
    const [roomCount, agentCount, messageCount, discussionCount] = await Promise.all([
      prisma.room.count(),
      prisma.agent.count(),
      prisma.message.count(),
      prisma.discussion.count(),
    ]);

    res.json({
      success: true,
      database: {
        rooms: roomCount,
        agents: agentCount,
        messages: messageCount,
        discussions: discussionCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DebugRoute] Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
