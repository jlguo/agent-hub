'use client';

import { useCallback } from 'react';
import { MessageSquare, Users, Settings } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { useSocket } from './hooks/useSocket';
import { useChat } from './hooks/useChat';

export default function Home() {
  const { socket, messages, setMessages, joinRoom } = useSocket();
  const {
    rooms,
    selectedRoom,
    agents,
    isLoading,
    messagesEndRef,
    selectRoom,
    sendMessage,
  } = useChat(socket, messages, setMessages);

  const handleSelectRoom = useCallback((room: Parameters<typeof selectRoom>[0]) => {
    selectRoom(room);
    joinRoom(room.id);
  }, [selectRoom, joinRoom]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Room List */}
      <Sidebar rooms={rooms} selectedRoom={selectedRoom} onSelectRoom={handleSelectRoom} />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-border-default p-4">
              <h2 className="text-lg font-semibold text-text-primary">{selectedRoom.name}</h2>
              <p className="text-sm text-text-secondary">{selectedRoom.description}</p>

              {/* Active Agents */}
              <div className="flex gap-2 mt-2">
                {agents.map((agent) => (
                  <div
                    key={`${agent.id}-${agent.name}`}
                    className="flex items-center gap-1 px-2 py-1 bg-surface rounded-full text-sm"
                  >
                    <span>{agent.avatar}</span>
                    <span className="text-text-secondary">{agent.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesEndRef} className="flex-1 min-h-0 flex flex-col">
              <MessageList messages={messages} />
            </div>

            {/* Input */}
            <ChatInput onSend={sendMessage} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary">
            Select a room to start chatting
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border-default flex justify-around py-2">
        <button className="flex flex-col items-center p-2 text-primary">
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs mt-1">Chat</span>
        </button>
        <button className="flex flex-col items-center p-2 text-text-secondary">
          <Users className="w-6 h-6" />
          <span className="text-xs mt-1">Agents</span>
        </button>
        <button className="flex flex-col items-center p-2 text-text-secondary">
          <Settings className="w-6 h-6" />
          <span className="text-xs mt-1">Settings</span>
        </button>
      </div>
    </div>
  );
}
