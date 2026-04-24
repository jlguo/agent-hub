import { Prisma } from '@prisma/client';

/**
 * Room Factory
 * Creates consistent test rooms with overrides
 */

const defaultRoom: Prisma.RoomCreateInput = {
  id: 'test-room',
  name: 'Test Room',
  type: 'family',
  description: 'Test room for unit tests',
};

export function createRoom(overrides: Partial<Prisma.RoomCreateInput> = {}) {
  return {
    ...defaultRoom,
    ...overrides,
  };
}

export function createFamilyRoom(name: string = 'Family Room') {
  return createRoom({
    id: 'test-family-room',
    name,
    type: 'family',
    description: 'Test family room',
  });
}

export function createDemoRoom() {
  return createRoom({
    id: 'family-room-demo',
    name: 'Family Room Demo',
    type: 'family',
    description: 'Demo room',
  });
}
