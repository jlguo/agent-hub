/**
 * Test Data Factories
 *
 * Helper functions for creating test data with sensible defaults.
 * All factories support partial overrides for customization.
 */

import { Discussion, Relationship, Session, Message } from '@prisma/client';

/**
 * Discussion test data factory
 *
 * @param overrides - Partial discussion data to override defaults
 * @returns Complete discussion data object
 *
 * @example
 * const discussion = createTestDiscussion({ topic: 'Weekend plans' });
 */
export function createTestDiscussion(
  overrides: Partial<Discussion> = {}
): Omit<Discussion, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    roomId: overrides.roomId || 'test-room-id',
    topic: overrides.topic || 'Test Discussion',
    status: overrides.status || 'active',
    heatScore: overrides.heatScore ?? 50,
    lastActivityAt: overrides.lastActivityAt || new Date(),
    archivedAt: overrides.archivedAt || null,
    metadata: overrides.metadata || null,
  };
}

/**
 * Relationship test data factory
 *
 * @param overrides - Partial relationship data to override defaults
 * @returns Complete relationship data object
 *
 * @example
 * const relationship = createTestRelationship({
 *   agentAId: 'dad',
 *   agentBId: 'mom',
 *   type: 'spouse'
 * });
 */
export function createTestRelationship(
  overrides: Partial<Relationship> = {}
): Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    agentAId: overrides.agentAId || 'agent-a-id',
    agentBId: overrides.agentBId || 'agent-b-id',
    type: overrides.type || 'friend',
    strength: overrides.strength ?? 50,
    metadata: overrides.metadata || null,
  };
}

/**
 * Session test data factory
 *
 * @param overrides - Partial session data to override defaults
 * @returns Complete session data object
 *
 * @example
 * const session = createTestSession({
 *   roomId: 'room-123',
 *   status: 'active'
 * });
 */
export function createTestSession(
  overrides: Partial<Session> = {}
): Omit<Session, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    roomId: overrides.roomId || 'test-room-id',
    gatewayId: overrides.gatewayId || null,
    status: overrides.status || 'active',
    lastActivityAt: overrides.lastActivityAt || new Date(),
    expiresAt: overrides.expiresAt || null,
    terminatedAt: overrides.terminatedAt || null,
    metadata: overrides.metadata || null,
  };
}

/**
 * Message test data factory
 *
 * @param overrides - Partial message data to override defaults
 * @returns Complete message data object
 *
 * @example
 * const message = createTestMessage({
 *   roomId: 'room-123',
 *   content: 'Hello!',
 *   senderType: 'human'
 * });
 */
export function createTestMessage(
  overrides: Partial<Message> = {}
): Omit<Message, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    roomId: overrides.roomId || 'test-room-id',
    content: overrides.content || 'Test message',
    senderType: overrides.senderType || 'human',
    agentId: overrides.agentId || null,
    discussionId: overrides.discussionId || null,
    metadata: overrides.metadata || null,
  };
}

/**
 * Generate unique test ID with prefix
 *
 * @param prefix - ID prefix (default: 'test')
 * @returns Unique ID string
 *
 * @example
 * const id = generateTestId('room'); // 'room-1234567890'
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create multiple test items with factory function
 *
 * @param factory - Factory function to use
 * @param count - Number of items to create
 * @param baseOverrides - Base overrides applied to all items
 * @returns Array of test data objects
 *
 * @example
 * const messages = createMultipleTestItems(createTestMessage, 5, { roomId: 'room-123' });
 */
export function createMultipleTestItems<T>(
  factory: (overrides: Partial<T>) => Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  count: number,
  baseOverrides: Partial<T> = {}
): Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> {
  return Array.from({ length: count }, (_, i) =>
    factory({
      ...baseOverrides,
      topic: baseOverrides.topic ? `${baseOverrides.topic} ${i + 1}` : undefined,
      content: baseOverrides.content ? `${baseOverrides.content} ${i + 1}` : undefined,
    } as Partial<T>)
  );
}
