'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Message } from '../types';

interface MessageListProps {
  messages: Message[];
}

export const MessageList = React.memo(function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-text-secondary mt-8">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No messages yet. Start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" data-testid="message-list">
      {messages.map((message) => {
        // Discussion start/end system messages
        if (message.senderType === 'system') {
          return (
            <div
              key={`${message.id}-${message.createdAt}`}
              className="flex justify-center my-4"
              data-testid={`message-${message.id}`}
            >
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-center max-w-[90%]">
                <div className="text-sm text-purple-800 whitespace-pre-line break-words">{message.content}</div>
              </div>
            </div>
          );
        }

        // Normal messages (human or agent)
        return (
          <div
            key={`${message.id}-${message.createdAt}`}
            className={`flex ${message.senderType === 'human' ? 'justify-end' : 'justify-start'} items-start gap-2`}
            data-testid={`message-${message.id}`}
          >
            {/* Agent Avatar - only for agent messages */}
            {message.senderType === 'agent' && message.agentAvatar && (
              <div className="text-2xl flex-shrink-0 mt-1" data-testid="agent-avatar">
                {message.agentAvatar}
              </div>
            )}

            <div
              className={`max-w-[70%] min-w-0 rounded-lg p-3 ${
                message.senderType === 'human'
                  ? 'bg-primary text-white'
                  : 'bg-surface-elevated border border-border-default'
              }`}
              data-testid="message-bubble"
            >
              {message.agentName && (
                <div className="text-xs font-medium mb-1 opacity-75 flex items-center gap-1" data-testid="agent-name">
                  <span>{message.agentAvatar}</span>
                  <span>{message.agentName}</span>
                </div>
              )}
              <div className="text-sm whitespace-pre-line break-words [overflow-wrap:anywhere]">{message.content}</div>
              <div className="text-xs mt-1 opacity-50">
                {message.createdAt && !isNaN(new Date(message.createdAt).getTime())
                  ? new Date(message.createdAt).toLocaleTimeString()
                  : 'Just now'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
