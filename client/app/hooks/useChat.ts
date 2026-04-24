'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Room, Agent, Message, MessagesResponse } from '../types';
import { Socket } from 'socket.io-client';

export function useChat(
  socket: Socket | null,
  socketMessages: Message[],
  setSocketMessages: (msgs: Message[]) => void
) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change
  useEffect(() => {
    if (socketMessages.length > 0) {
      requestAnimationFrame(() => {
        const container = messagesEndRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        }
      });
    }
  }, [socketMessages]);

  // Load rooms on mount
  useEffect(() => {
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => {
        setRooms(data);
        if (data.length > 0) {
          selectRoom(data[0]);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const selectRoom = useCallback(
    (room: Room) => {
      setSelectedRoom(room);
      setAgents(room.agents);

      // Join room in WebSocket
      if (socket?.connected) {
        socket.emit('room:join', { roomId: room.id });
      }

      // Load messages for this room
      fetch(`/api/rooms/${room.id}`)
        .then((res) => res.json())
        .then((data: MessagesResponse | Message[]) => {
          // Handle both old format (array) and new format ({ messages, pagination })
          const messagesArray = Array.isArray(data) ? data : data.messages || [];
          setSocketMessages(messagesArray);
        })
        .catch(() => {});
    },
    [socket, setSocketMessages]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !selectedRoom) return;

      const message = {
        content,
        role: 'user',
      };

      try {
        const res = await fetch(`/api/messages/rooms/${selectedRoom.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });

        if (res.ok) {
          // WebSocket broadcast will add the message to the list
        } else {
          const error = await res.text();
          alert('Failed to send message: ' + error);
        }
      } catch (error) {
        alert('Error: ' + (error as Error).message);
      }
    },
    [selectedRoom]
  );

  return {
    rooms,
    selectedRoom,
    agents,
    isLoading,
    messagesEndRef,
    selectRoom,
    sendMessage,
  };
}
