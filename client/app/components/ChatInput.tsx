'use client';

import React, { useState, useCallback } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput = React.memo(function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState('');

  const handleSend = useCallback(() => {
    if (!inputMessage.trim() || disabled) return;
    onSend(inputMessage);
    setInputMessage('');
  }, [inputMessage, disabled, onSend]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  }, [handleSend]);

  return (
    <div className="bg-white border-t border-border-default p-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={disabled}
          data-testid="message-input"
          className="flex-1 px-4 py-2 border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !inputMessage.trim()}
          data-testid="send-button"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>
    </div>
  );
});
