/**
 * Shared type definitions for the Agent Hub frontend.
 * Centralized here to ensure type consistency across components and hooks.
 */

export interface Room {
  id: string;
  name: string;
  type: string;
  description: string;
  agents: Agent[];
  _count: { messages: number; discussions: number };
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  roomId: string;
  agentId: string | null;
  agentName?: string;
  agentAvatar?: string;
  senderType: 'human' | 'agent' | 'system';
  content: string;
  createdAt: string;
}

export interface PaginationInfo {
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

export interface MessagesResponse {
  messages: Message[];
  pagination: PaginationInfo;
}
