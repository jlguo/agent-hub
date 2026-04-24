'use client';

import React from 'react';
import { Room } from '../types';

interface SidebarProps {
  rooms: Room[];
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
}

export const Sidebar = React.memo(function Sidebar({ rooms, selectedRoom, onSelectRoom }: SidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-border-default flex flex-col">
      <div className="p-4 border-b border-border-default">
        <h1 className="text-xl font-bold text-text-primary">Agent Hub</h1>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0" data-testid="room-list">
        {rooms.map((room) => (
          <button
            key={`${room.id}-${room.name}`}
            onClick={() => onSelectRoom(room)}
            className={`w-full p-4 text-left hover:bg-surface transition-colors border-b border-border-default ${
              selectedRoom?.id === room.id ? 'bg-primary-subtle' : ''
            }`}
            data-testid={`room-${room.id}`}
          >
            <div className="font-medium text-text-primary" data-testid="room-name">{room.name}</div>
            <div className="text-sm text-text-secondary">{room.type}</div>
            <div className="text-xs text-text-secondary mt-1">
              {room.agents.length} agents &bull; {room._count.messages} messages
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});
