import React, { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Send, MessageSquare } from 'lucide-react';
import { ChatMessage, UserProfile } from '../types';
import { playSound } from '../services/audio';

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (res.status === 401) return [];
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch (e) {
    return [];
  }
};

interface ChatPanelProps {
  groupId: string;
  currentUser: UserProfile;
  themeColor: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ groupId, currentUser, themeColor }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Poll every 2 seconds
  const { data: messages, mutate } = useSWR<ChatMessage[]>(
    groupId ? `/api/groups/${groupId}/chat` : null, 
    fetcher, 
    { refreshInterval: 2000, fallbackData: [] }
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Use actual username for optimistic update
    const optimisticMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      sender: currentUser.username, 
      text: input,
      timestamp: Date.now()
    };

    // Optimistic Update
    mutate([...(messages || []), optimisticMsg], false);
    setInput('');
    playSound('click');

    try {
      await fetch(`/api/groups/${groupId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: optimisticMsg.text })
      });
      mutate(); // Re-fetch to confirm
    } catch (err) {
      console.error("Failed to send");
    }
  };

  if (!groupId) return null;

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 w-full md:w-80">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
        <MessageSquare size={18} style={{ color: themeColor }} />
        <span className="font-bold text-zinc-200">Group Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!messages ? (
          <div className="text-zinc-600 text-center text-xs mt-10">Loading frequency...</div>
        ) : messages.length === 0 ? (
          <div className="text-zinc-600 text-center text-xs mt-10">No signals detected. Start transmission.</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === currentUser.username;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`
                  max-w-[85%] rounded-xl px-3 py-2 text-sm font-medium
                  ${isMe 
                    ? 'bg-zinc-800 text-white border border-zinc-700' 
                    : 'bg-black/40 text-zinc-300 border border-zinc-800'
                  }
                `} style={isMe ? { borderColor: themeColor, backgroundColor: `${themeColor}10` } : {}}>
                  {!isMe && <div className="text-[10px] text-zinc-500 mb-1 font-bold">{msg.sender}</div>}
                  {msg.text}
                </div>
                <span className="text-[9px] text-zinc-600 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-950/50">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Transmit message..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-full pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500"
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            className="absolute right-1.5 top-1.5 p-1.5 bg-zinc-800 rounded-full text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;