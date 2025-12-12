import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { LayoutGrid, Plus, Hash, Settings, Activity, LogOut, User, Mail, Trash2, CheckCircle } from 'lucide-react';
import { Group, UserProfile, Workspace } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { APP_VERSION } from '../constants';

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
  activeWorkspaceId?: string;
  onNavigate: (view: 'personal' | 'group', id?: string) => void;
  onCreateGroup: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  onLogout: () => void;
  onLogin: () => void;
  currentUser: UserProfile | null;
  themeColor: string;
  onOpenInvites?: () => void;
  onOpenWhatsNew?: () => void;
  workspaces: Workspace[];
  onRefreshWorkspaces: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  activeGroupId, 
  activeWorkspaceId = 'default',
  onNavigate, 
  onCreateGroup, 
  onOpenSettings,
  onOpenStats,
  onLogout,
  onLogin,
  currentUser,
  themeColor,
  onOpenInvites,
  onOpenWhatsNew,
  workspaces,
  onRefreshWorkspaces
}) => {
  const { data: groups } = useSWR<Group[]>(currentUser ? '/api/groups' : null, fetcher, { fallbackData: [] });
  // Poll invites for notification badge
  const { data: invites } = useSWR<Group[]>(currentUser ? '/api/user/invites' : null, fetcher, { refreshInterval: 5000 });
  const { t } = useLanguage();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const handleCreateWorkspace = async () => {
      if(!newWorkspaceName.trim()) return;
      try {
          const res = await fetch('/api/workspaces', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ name: newWorkspaceName })
          });
          if(res.ok) {
              setNewWorkspaceName('');
              setIsCreatingWorkspace(false);
              onRefreshWorkspaces();
          }
      } catch(e) { console.error(e); }
  };

  const handleDeleteWorkspace = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(!confirm(t.deleteWorkspace)) return;
      try {
          await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
          if (activeWorkspaceId === id) onNavigate('personal', 'default');
          onRefreshWorkspaces();
      } catch(e) { console.error(e); }
  };

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tighter text-white">
          GROOVE<span style={{ color: themeColor }}>TASK</span>
        </h1>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 space-y-6 overflow-y-auto">
        
        {/* WORKSPACES SECTION */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-2 flex justify-between items-center">
             {t.workspaces}
             {currentUser && workspaces.length < 5 && (
                 <button onClick={() => setIsCreatingWorkspace(!isCreatingWorkspace)} className="hover:text-white transition-colors">
                     <Plus size={14} />
                 </button>
             )}
          </h3>

          {/* New Workspace Input */}
          {isCreatingWorkspace && (
              <div className="px-2 mb-2 animate-in slide-in-from-left-2">
                  <div className="flex gap-1">
                      <input 
                         autoFocus
                         className="bg-zinc-900 border border-zinc-700 rounded-lg text-xs p-1.5 w-full text-white"
                         placeholder="Workspace Name"
                         value={newWorkspaceName}
                         onChange={e => setNewWorkspaceName(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleCreateWorkspace()}
                      />
                      <button onClick={handleCreateWorkspace} className="p-1.5 bg-zinc-800 rounded-lg text-green-500 hover:bg-zinc-700">
                          <CheckCircle size={14} />
                      </button>
                  </div>
              </div>
          )}

          <div className="space-y-1">
             {/* Local / Default View if not logged in */}
             {!currentUser && (
                <button
                    onClick={() => onNavigate('personal', 'default')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    currentView === 'personal' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                >
                    <LayoutGrid size={18} />
                    {t.appName}
                </button>
             )}

             {/* Logged In Workspaces */}
             {currentUser && workspaces.map(w => (
                 <button
                    key={w.id}
                    onClick={() => onNavigate('personal', w.id)}
                    className={`w-full flex items-center justify-between group px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        currentView === 'personal' && activeWorkspaceId === w.id
                        ? 'bg-zinc-800 text-white' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                >
                    <div className="flex items-center gap-3 truncate">
                        <LayoutGrid size={18} />
                        <span className="truncate">{w.name}</span>
                    </div>
                    {w.id !== 'default' && (
                        <div 
                           onClick={(e) => handleDeleteWorkspace(e, w.id)}
                           className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-500 transition-all"
                        >
                            <Trash2 size={12} />
                        </div>
                    )}
                </button>
             ))}
          </div>

          
          {currentUser && (
             <button
               onClick={onOpenInvites}
               className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors mt-2 border-t border-zinc-800/50"
             >
               <div className="flex items-center gap-3">
                  <Mail size={18} />
                  Inbox
               </div>
               {invites && invites.length > 0 && (
                   <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                       {invites.length}
                   </span>
               )}
             </button>
          )}
        </div>

        {/* CREWS SECTION */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.crews}</h3>
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
                   className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center font-bold text-xs border overflow-hidden"
                   style={{ borderColor: themeColor, color: themeColor }}
                >
                   {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
                   ) : (
                      currentUser.username[0].toUpperCase()
                   )}
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

         <div className="pt-2 flex justify-center">
            <button 
              onClick={onOpenWhatsNew} 
              className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {APP_VERSION}
            </button>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;