import React, { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { Plus, Settings, Volume2, VolumeX, Menu, X, User, LogOut, Check, LayoutGrid, Info, UserPlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactSortablePkg from 'react-sortablejs';
const ReactSortable = (ReactSortablePkg as any).ReactSortable || ReactSortablePkg;

import { Task, AppState, DailyStat, ThemeColor, TaskType, UserProfile, Group } from './types';
import { THEME_COLORS, STORAGE_KEY, THEME_KEY, APP_VERSION } from './constants';
import { playSound } from './services/audio';
import { useLanguage } from './contexts/LanguageContext';

import PadItem from './components/PadItem';
import StatsPanel from './components/StatsPanel';
import DeleteModal from './components/DeleteModal';
import LoginModal from './components/LoginModal';
import WhatsNewModal from './components/WhatsNewModal';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import CreateGroupModal from './components/CreateGroupModal';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const INITIAL_STATE: AppState = { tasks: [], history: [] };

function App() {
  const { t, setLanguage } = useLanguage();
  
  // --- View State ---
  const [view, setView] = useState<'personal' | 'group'>('personal');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Core State ---
  // Personal Tasks (Local + Sync)
  const [personalTasks, setPersonalTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<DailyStat[]>([]);
  
  // Group Tasks (SWR)
  const { data: groupTasks, mutate: mutateGroupTasks } = useSWR<Task[]>(
    activeGroupId ? `/api/groups/${activeGroupId}/tasks` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  const activeTasks = view === 'personal' ? personalTasks : (groupTasks || []);

  const [theme, setTheme] = useState<ThemeColor>(THEME_COLORS[0]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('groovetask_sound');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const isLoggedIn = !!currentUser;

  // --- UI State ---
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // --- Form State ---
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<TaskType>('simple');
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [inviteUser, setInviteUser] = useState(''); // For group invite

  // --- Effects ---
  useEffect(() => {
    // Check Auth
    fetch('/api/auth/me').then(res => {
      if(res.ok) return res.json();
      throw new Error();
    }).then(data => {
      if(data.isAuthenticated) {
        setCurrentUser(data.user);
        if(data.user.settings) applySettings(data.user.settings);
        if(data.user.data) {
           setPersonalTasks(data.user.data.tasks || []);
           setHistory(data.user.data.history || []);
        }
      }
    }).catch(() => {});

    // Local Storage Fallback for Personal
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData && !isLoggedIn) {
      const parsed = JSON.parse(savedData);
      setPersonalTasks(parsed.tasks || []);
      setHistory(parsed.history || []);
    }
    
    // Check Version
    if (localStorage.getItem('groovetask_version') !== APP_VERSION) {
       setTimeout(() => setShowWhatsNew(true), 500);
    }
  }, [isLoggedIn]);

  // Persist Personal
  useEffect(() => {
    if (view === 'personal') {
       localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: personalTasks, history }));
    }
  }, [personalTasks, history, view]);

  const applySettings = (settings: any) => {
    if (settings.themeId) setTheme(THEME_COLORS.find(t => t.id === settings.themeId) || THEME_COLORS[0]);
    if (typeof settings.soundEnabled === 'boolean') setSoundEnabled(settings.soundEnabled);
    if (settings.language) setLanguage(settings.language);
  };

  const addToast = (message: string, type: ToastType = 'info') => {
    setToasts(prev => [...prev, { id: uuidv4(), message, type }]);
  };

  // --- Handlers ---
  const handleNavigate = (newView: 'personal' | 'group', groupId?: string) => {
    setView(newView);
    if (groupId) setActiveGroupId(groupId);
    setSidebarOpen(false);
  };

  const handleToggleTask = async (id: string) => {
    if (isReordering) return;
    const task = activeTasks.find(t => t.id === id);
    if (!task) return;

    if (view === 'personal') {
       // ... (Keep existing Personal Logic for brevity, assuming standard implementation)
       const newTasks = personalTasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted, completedAt: !t.isCompleted ? Date.now() : null } : t);
       setPersonalTasks(newTasks);
       if (!task.isCompleted && soundEnabled) playSound('check');
       if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks })});
    } else {
       // Group Logic (Optimistic SWR)
       const updatedTask = { ...task, isCompleted: !task.isCompleted, completedAt: !task.isCompleted ? Date.now() : null };
       if (!task.isCompleted && soundEnabled) playSound('check');
       
       // Optimistic update
       mutateGroupTasks(activeTasks.map(t => t.id === id ? updatedTask : t), false);
       
       try {
         await fetch(`/api/groups/${activeGroupId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTask)
         });
         mutateGroupTasks();
       } catch (e) {
         mutateGroupTasks(); // Revert
         addToast("Failed to update task", "error");
       }
    }
  };

  const handleCreateTask = async () => {
    if (!formTitle.trim()) return;
    const newTask: Task = {
      id: uuidv4(),
      type: formType,
      title: formTitle,
      description: formDesc,
      isCompleted: false,
      completedAt: null,
      createdAt: Date.now(),
      count: 0,
      log: []
    };

    if (view === 'personal') {
       const newTasks = [...personalTasks, newTask];
       setPersonalTasks(newTasks);
       if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks })});
    } else {
       if (!activeGroupId) return;
       mutateGroupTasks([...(groupTasks || []), newTask], false);
       await fetch(`/api/groups/${activeGroupId}/tasks`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newTask)
       });
       mutateGroupTasks();
    }
    setShowTaskModal(false);
    setFormTitle('');
    setFormDesc('');
    if (soundEnabled) playSound('click');
  };

  const handleDeleteTask = async () => {
     if (!deleteTaskId) return;
     
     if (view === 'personal') {
        const newTasks = personalTasks.filter(t => t.id !== deleteTaskId);
        setPersonalTasks(newTasks);
        if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks })});
     } else {
        const newTasks = (groupTasks || []).filter(t => t.id !== deleteTaskId);
        mutateGroupTasks(newTasks, false);
        await fetch(`/api/groups/${activeGroupId}/tasks/${deleteTaskId}`, { method: 'DELETE' });
        mutateGroupTasks();
     }
     setDeleteTaskId(null);
  };

  const handleInvite = async () => {
     if(!activeGroupId || !inviteUser) return;
     const res = await fetch(`/api/groups/${activeGroupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inviteUser })
     });
     if(res.ok) {
        addToast("User added to crew", "success");
        setInviteUser('');
     } else {
        addToast("User not found", "error");
     }
  };

  // --- Render ---

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <Toast toasts={toasts} onRemove={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      {/* Sidebar (Desktop) */}
      <Sidebar 
         currentView={view} 
         activeGroupId={activeGroupId} 
         onNavigate={handleNavigate} 
         onCreateGroup={() => setShowCreateGroup(true)}
         themeColor={theme.hex}
      />
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 md:hidden" onClick={() => setSidebarOpen(false)}>
           <div className="w-64 h-full bg-zinc-900 animate-in slide-in-from-left" onClick={e => e.stopPropagation()}>
              <Sidebar 
                 currentView={view} 
                 activeGroupId={activeGroupId} 
                 onNavigate={handleNavigate} 
                 onCreateGroup={() => { setSidebarOpen(false); setShowCreateGroup(true); }}
                 themeColor={theme.hex}
              />
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <header className="flex items-center justify-between px-4 py-4 bg-zinc-950 border-b border-zinc-800 z-30 shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 bg-zinc-800 rounded-lg">
                <Menu size={20} />
             </button>
             <h2 className="text-xl font-bold flex items-center gap-2">
                {view === 'personal' ? 'My Board' : 'Crew Board'}
                {view === 'group' && (
                   <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-normal">
                      ID: {activeGroupId?.slice(0,4)}...
                   </span>
                )}
             </h2>
          </div>
          <div className="flex items-center gap-2">
             {view === 'group' && (
                <div className="hidden sm:flex items-center bg-zinc-900 rounded-full px-2 border border-zinc-800 mr-2">
                   <input 
                      className="bg-transparent border-none focus:outline-none text-xs w-24 px-2 py-1.5"
                      placeholder="Add member..."
                      value={inviteUser}
                      onChange={e => setInviteUser(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()}
                   />
                   <button onClick={handleInvite} className="text-zinc-500 hover:text-white"><UserPlus size={14}/></button>
                </div>
             )}
             <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-zinc-500 hover:text-white">
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
             </button>
             {!isLoggedIn ? (
                <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded-full text-sm font-bold">
                   <User size={16} /> Login
                </button>
             ) : (
                <button onClick={() => { fetch('/api/auth/logout', {method:'POST'}); setCurrentUser(null); setView('personal'); }} className="p-2 text-zinc-500 hover:text-red-400">
                   <LogOut size={20} />
                </button>
             )}
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Tasks Grid */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950">
             {/* Task List */}
             {activeTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 opacity-50">
                   <div className="w-20 h-20 border-2 border-dashed border-zinc-800 rounded-2xl flex items-center justify-center"><Plus size={32} /></div>
                   <p>No signal detected.</p>
                   <button onClick={() => { setFormTitle(''); setShowTaskModal(true); }} className="text-sm underline hover:text-zinc-400">Initialize Task</button>
                </div>
             ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20">
                   {/* We only use ReactSortable for Personal view reordering for now */}
                   {activeTasks.map((task, i) => (
                      <PadItem 
                        key={task.id} 
                        index={i} 
                        task={task} 
                        themeColor={theme.hex} 
                        themeShadow={theme.shadow}
                        onToggle={handleToggleTask}
                        onEdit={() => {}} 
                        onDelete={id => setDeleteTaskId(id)}
                        onViewInfo={() => {}}
                      />
                   ))}
                   <button onClick={() => { setFormTitle(''); setShowTaskModal(true); }} className="aspect-square rounded-xl border-2 border-dashed border-zinc-800 hover:bg-zinc-900 flex flex-col items-center justify-center gap-2 group transition-all">
                      <Plus size={24} className="text-zinc-700 group-hover:text-zinc-400" />
                   </button>
                </div>
             )}
          </main>
          
          {/* Chat Panel (Right Side for Group View) */}
          {view === 'group' && activeGroupId && currentUser && (
             <div className="hidden lg:block w-80 shrink-0 h-full border-l border-zinc-800 bg-zinc-900">
                <ChatPanel groupId={activeGroupId} currentUser={currentUser} themeColor={theme.hex} />
             </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateGroupModal 
         isOpen={showCreateGroup} 
         onClose={() => setShowCreateGroup(false)} 
         onGroupCreated={() => mutate('/api/groups')}
         themeColor={theme.hex}
      />
      
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={(u) => { setCurrentUser(u); setShowLoginModal(false); }} themeColor={theme.hex} />
      
      <DeleteModal isOpen={!!deleteTaskId} onClose={() => setDeleteTaskId(null)} onConfirm={handleDeleteTask} />

      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex justify-between mb-4">
                 <h3 className="font-bold text-white">New Transmission</h3>
                 <button onClick={() => setShowTaskModal(false)} className="text-zinc-500"><X size={20}/></button>
              </div>
              <input autoFocus value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Title" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white mb-3 focus:outline-none focus:border-zinc-600" />
              <div className="flex gap-2 mb-4">
                 <button onClick={() => setFormType('simple')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${formType === 'simple' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Simple</button>
                 <button onClick={() => setFormType('counter')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${formType === 'counter' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Counter</button>
              </div>
              <button onClick={handleCreateTask} disabled={!formTitle} className="w-full py-3 rounded-xl font-bold text-zinc-900 transition-transform hover:scale-105" style={{ backgroundColor: theme.hex }}>Create</button>
           </div>
        </div>
      )}

      <WhatsNewModal isOpen={showWhatsNew} onClose={() => { setShowWhatsNew(false); localStorage.setItem('groovetask_version', APP_VERSION); }} themeColor={theme.hex} />
    </div>
  );
}

export default App;