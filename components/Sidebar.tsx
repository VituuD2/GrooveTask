import React from 'react';
import useSWR from 'swr';
import { LayoutGrid, Users, Plus, Hash, Settings, Activity, LogOut, User } from 'lucide-react';
import { Group, UserProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

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

interface SidebarProps {
  currentView: 'personal' | 'group';
  activeGroupId: string | null;
  onNavigate: (view: 'personal' | 'group', groupId?: string) => void;
  onCreateGroup: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  onLogout: () => void;
  onLogin: () => void;
  currentUser: UserProfile | null;
  themeColor: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  activeGroupId, 
  onNavigate, 
  onCreateGroup, 
  onOpenSettings,
  onOpenStats,
  onLogout,
  onLogin,
  currentUser,
  themeColor 
}) => {
  const { data: groups } = useSWR<Group[]>('/api/groups', fetcher, { fallbackData: [] });
  const { t } = useLanguage();

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tighter text-white">
          GROOVE<span style={{ color: themeColor }}>TASK</span>
        </h1>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 space-y-6 overflow-y-auto">
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-2">Workspace</h3>
          <button
            onClick={() => onNavigate('personal')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              currentView === 'personal' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <LayoutGrid size={18} />
            {t.appName}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Crews</h3>
            <button onClick={onCreateGroup} className="text-zinc-500 hover:text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {Array.isArray(groups) && groups.map(group => (
              <button
                key={group.id}
                onClick={() => onNavigate('group', group.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  currentView === 'group' && activeGroupId === group.id
                    ? 'bg-zinc-800 text-white' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Hash size={16} className="text-zinc-600" />
                {group.name}
              </button>
            ))}
            {(!groups || groups.length === 0) && (
              <div className="px-3 py-2 text-xs text-zinc-600 italic">No groups yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-zinc-800 space-y-2">
         {currentUser ? (
             <div className="flex items-center gap-3 px-2 py-2 mb-2">
                <div 
                   className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center font-bold text-xs border"
                   style={{ borderColor: themeColor, color: themeColor }}
                >
                   {currentUser.username[0].toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                   <div className="text-sm font-bold text-white truncate">{currentUser.username}</div>
                   <div className="text-[10px] text-zinc-500 truncate">Online</div>
                </div>
             </div>
         ) : (
             <button 
                onClick={onLogin}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
             >
                <User size={18} />
                {t.loginSync}
             </button>
         )}

         <button 
            onClick={onOpenStats}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
         >
            <Activity size={18} />
            {t.performance}
         </button>
         
         <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
         >
            <Settings size={18} />
            {t.studioSettings}
         </button>

         {currentUser && (
            <button 
               onClick={onLogout}
               className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/10 transition-colors"
            >
               <LogOut size={18} />
               {t.logout}
            </button>
         )}
      </div>
    </div>
  );
};

export default Sidebar;