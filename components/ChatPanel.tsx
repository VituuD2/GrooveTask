import React, { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Send, MessageSquare, Hash, User } from 'lucide-react';
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
  groupName?: string;
  currentUser: UserProfile;
  themeColor: string;
  onMessageReceived?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ groupId, groupName, currentUser, themeColor, onMessageReceived }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevMessagesLengthRef = useRef(0);
  
  // Smart polling configuration
  const { data: messages, mutate } = useSWR<ChatMessage[]>(
    groupId ? `/api/groups/${groupId}/chat` : null, 
    fetcher, 
    { 
      refreshInterval: 1500,        // Poll every 1.5s when active
      revalidateOnFocus: true,      // Fetch immediately when tab gets focus
      refreshWhenHidden: false,     // Stop polling when tab is backgrounded
      refreshWhenOffline: false,    // Stop polling when offline
      fallbackData: [] 
    }
  );

  // Auto-scroll & Notification Logic
  useEffect(() => {
    if (messages) {
      // Notification Check
      if (messages.length > prevMessagesLengthRef.current) {
          const lastMsg = messages[messages.length - 1];
          // Only notify if message is NOT from me
          if (lastMsg.sender !== currentUser.username) {
             if (onMessageReceived) onMessageReceived();
          }
      }
      prevMessagesLengthRef.current = messages.length;

      // Scroll Check
      if (shouldAutoScroll) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, shouldAutoScroll, currentUser.username, onMessageReceived]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // If user is near bottom, enable auto-scroll, otherwise disable
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    }
  };

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
    setShouldAutoScroll(true); // Force scroll on send
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
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 w-full md:w-80 shadow-xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
           <div 
             className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
             style={{ backgroundColor: themeColor, boxShadow: `0 4px 15px -3px ${themeColor}60` }}
           >
              <Hash size={20} />
           </div>
           <div className="flex flex-col">
              <span className="font-bold text-white text-sm leading-tight truncate max-w-[150px]">
                {groupName || 'Crew Chat'}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">
                 Live Feed
              </span>
           </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/50"
      >
        {!messages ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
             <span className="animate-pulse">Syncing frequency...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 opacity-50">
             <MessageSquare size={32} />
             <p className="text-xs">Quiet on deck.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender === currentUser.username;
            const prevMsg = messages[idx - 1];
            // Check if previous message was from same sender within 2 mins
            const isSequence = prevMsg && prevMsg.sender === msg.sender && (msg.timestamp - prevMsg.timestamp < 120000);

            return (
              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isSequence ? 'mt-1' : 'mt-4'}`}>
                
                {/* Avatar (Only for Them, only if not sequence) */}
                {!isMe && (
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 text-[10px] font-bold shrink-0 ${isSequence ? 'invisible' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                      {msg.sender[0].toUpperCase()}
                   </div>
                )}

                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name (Only for Them, only if not sequence) */}
                  {!isMe && !isSequence && (
                    <span className="text-[10px] text-zinc-500 ml-1 mb-1 font-semibold">{msg.sender}</span>
                  )}
                  
                  {/* Bubble */}
                  <div className={`
                    relative px-3.5 py-2 text-sm leading-snug break-words
                    ${isMe 
                      ? 'bg-white text-black rounded-2xl rounded-tr-sm font-medium' 
                      : 'bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm border border-zinc-700'
                    }
                  `}
                  style={isMe ? { backgroundColor: themeColor, color: '#fff', boxShadow: `0 2px 10px -2px ${themeColor}50` } : {}}
                  >
                    {msg.text}
                  </div>
                  
                  {/* Timestamp */}
                  <span className={`text-[9px] text-zinc-600 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <div className="relative flex items-end gap-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-1.5 focus-within:border-zinc-600 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-transparent border-none pl-3 py-2.5 text-sm text-white focus:outline-none placeholder-zinc-600 min-h-[44px]"
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            className="p-2.5 rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 mb-0.5"
            style={{ backgroundColor: input.trim() ? themeColor : '#27272a' }}
          >
            <Send size={16} fill="currentColor" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;