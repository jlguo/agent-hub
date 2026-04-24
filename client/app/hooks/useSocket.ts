'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const selectedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const socketInstance = io(WS_URL);

    socketInstance.on('connect', () => {
      // Re-join room if already selected
      if (selectedRoomRef.current) {
        socketInstance.emit('room:join', { roomId: selectedRoomRef.current });
      }
    });

    socketInstance.on('message:new', (message: Message) => {
      setMessages((prev) => {
        const exists = prev.find((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const joinRoom = useCallback(
    (roomId: string) => {
      selectedRoomRef.current = roomId;
      if (socket?.connected) {
        socket.emit('room:join', { roomId });
      }
    },
    [socket]
  );

  const setMessagesDirect = useCallback((msgs: Message[]) => {
    setMessages(msgs);
  }, []);

  return { socket, messages, setMessages: setMessagesDirect, joinRoom };
}
