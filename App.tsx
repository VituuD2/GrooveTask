import React, { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { Plus, Settings, Volume2, VolumeX, Menu, X, User, LogOut, Check, LayoutGrid, Info, UserPlus, Save, Globe, Edit2, Loader2, AlertCircle, Clock, Trash2, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactSortablePkg from 'react-sortablejs';
// Handle ESM/CommonJS import differences for Sortable
const ReactSortable = (ReactSortablePkg as any).ReactSortable || ReactSortablePkg;

import { Task, AppState, DailyStat, ThemeColor, TaskType, UserProfile, Group } from './types';
import { THEME_COLORS, STORAGE_KEY, THEME_KEY, APP_VERSION } from './constants';
import { playSound } from './services/audio';
import { useLanguage } from './contexts/LanguageContext';
import { LANGUAGE_NAMES, LanguageCode } from './translations';

import PadItem from './components/PadItem';
import StatsPanel from './components/StatsPanel';
import DeleteModal from './components/DeleteModal';
import LoginModal from './components/LoginModal';
import WhatsNewModal from './components/WhatsNewModal';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import CreateGroupModal from './components/CreateGroupModal';
import GroupInfoModal from './components/GroupInfoModal';
import InvitesModal from './components/InvitesModal';

// Robust fetcher that handles 401s and ensures arrays are returned for lists
const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (res.status === 401) return []; // Return empty list on unauthorized
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch (e) {
    return []; // Fallback to empty array on error
  }
};

const INITIAL_STATE: AppState = { tasks: [], history: [] };
const MAX_USERNAME_CHANGES = 3;

function App() {
  const { t, language, setLanguage } = useLanguage();
  
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
    { refreshInterval: 2000, fallbackData: [] }
  );

  // Derived state for safe rendering
  const activeTasks = view === 'personal' ? personalTasks : (Array.isArray(groupTasks) ? groupTasks : []);

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
  const [showStats, setShowStats] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // --- Form State ---
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isViewingInfo, setIsViewingInfo] = useState(false); // Mode: View vs Edit
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<TaskType>('simple');
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [inviteUser, setInviteUser] = useState(''); 

  // --- Settings Temp State ---
  const [tempTheme, setTempTheme] = useState<ThemeColor>(THEME_COLORS[0]);
  const [tempSound, setTempSound] = useState(true);
  const [tempLanguage, setTempLanguage] = useState<LanguageCode>('en');
  const [tempUsername, setTempUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [settingsError, setSettingsError] = useState<string | null>(null);

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
      try {
        const parsed = JSON.parse(savedData);
        setPersonalTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
        setHistory(Array.isArray(parsed.history) ? parsed.history : []);
      } catch (e) {
        console.error("Failed to parse local storage");
      }
    }
    
    // Check Version
    if (localStorage.getItem('groovetask_version') !== APP_VERSION) {
       setTimeout(() => setShowWhatsNew(true), 500);
    }
    
    // Load Theme
    const savedThemeId = localStorage.getItem(THEME_KEY);
    if (savedThemeId) {
       const found = THEME_COLORS.find(t => t.id === savedThemeId);
       if(found) setTheme(found);
    }
  }, [isLoggedIn]);

  // Persist Personal Data
  useEffect(() => {
    if (view === 'personal') {
       localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: personalTasks, history }));
       // Sync order if logged in
       if (isLoggedIn) {
           const order = personalTasks.map(t => t.id);
           fetch('/api/user/data', { 
               method: 'POST', 
               headers: {'Content-Type':'application/json'}, 
               body: JSON.stringify({ order })
           });
       }
    }
  }, [personalTasks, history, view, isLoggedIn]);
  
  // Persist Theme/Sound and Update Favicon
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme.id);
    localStorage.setItem('groovetask_sound', JSON.stringify(soundEnabled));
    
    // Update Favicon color
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (link) {
         const color = theme.hex.replace('#', '%23');
         link.href = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%2318181b' rx='20'/%3E%3Crect x='25' y='25' width='50' height='50' fill='${color}' rx='10'/%3E%3Ccircle cx='75' cy='25' r='5' fill='%2352525b'/%3E%3C/svg%3E`;
    }
  }, [theme, soundEnabled]);

  // Username Check Effect
  useEffect(() => {
    if (!showSettingsModal || !isLoggedIn) return;
    if (tempUsername === currentUser?.username) {
        setUsernameStatus('idle');
        return;
    }
    if (tempUsername.length < 3) {
        setUsernameStatus('idle');
        return;
    }

    const timer = setTimeout(async () => {
        setUsernameStatus('checking');
        try {
            const res = await fetch('/api/auth/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: tempUsername })
            });
            const data = await res.json();
            setUsernameStatus(data.available ? 'available' : 'taken');
        } catch {
            setUsernameStatus('idle');
        }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [tempUsername, showSettingsModal, isLoggedIn, currentUser]);

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
  
  const handleLogout = () => {
      fetch('/api/auth/logout', {method:'POST'}); 
      setCurrentUser(null); 
      setView('personal');
      setActiveGroupId(null);
  };

  // --- Task Logic ---

  const handleSetList = (newList: Task[]) => {
    // ReactSortable calls this whenever items are dragged
    if (view === 'personal') {
      setPersonalTasks(newList);
    } else {
      // For groups, we optimistic update, but backend needs an order implementation
      // For now, we just update local SWR cache
      mutateGroupTasks(newList, false);
    }
  };

  const handleToggleTask = async (id: string) => {
    if (isReordering) return;
    const task = activeTasks.find(t => t.id === id);
    if (!task) return;

    if (view === 'personal') {
       // Counter Logic
       if (task.type === 'counter') {
           const newTasks = personalTasks.map(t => {
               if(t.id === id) {
                   const count = (t.count || 0) + 1;
                   const log = [{ id: uuidv4(), timestamp: Date.now() }, ...(t.log || [])];
                   return { ...t, count, log, completedAt: Date.now() };
               }
               return t;
           });
           setPersonalTasks(newTasks);
           if(soundEnabled) playSound('check', 600);
           if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks })});
       } else {
           // Simple Logic
           const newTasks = personalTasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted, completedAt: !t.isCompleted ? Date.now() : null } : t);
           setPersonalTasks(newTasks);
           if (!task.isCompleted && soundEnabled) playSound('check');
           if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks })});
       }
    } else {
       // Group Logic (Optimistic SWR)
       let updatedTask = { ...task };
       if (task.type === 'counter') {
           updatedTask.count = (updatedTask.count || 0) + 1;
           updatedTask.log = [{ id: uuidv4(), timestamp: Date.now() }, ...(updatedTask.log || [])];
           updatedTask.completedAt = Date.now();
           if(soundEnabled) playSound('check', 600);
       } else {
           updatedTask.isCompleted = !task.isCompleted;
           updatedTask.completedAt = !task.isCompleted ? Date.now() : null;
           if(!task.isCompleted && soundEnabled) playSound('check');
       }
       
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
       if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks, order: newTasks.map(t => t.id) })});
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

  const handleUpdateTask = async () => {
    if (!currentTask || !formTitle.trim()) return;

    const updatedTask = { ...currentTask, title: formTitle, description: formDesc };

    if (view === 'personal') {
       const newTasks = personalTasks.map(t => t.id === currentTask.id ? updatedTask : t);
       setPersonalTasks(newTasks);
       if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks })});
    } else {
       mutateGroupTasks(activeTasks.map(t => t.id === currentTask.id ? updatedTask : t), false);
       await fetch(`/api/groups/${activeGroupId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTask)
       });
       mutateGroupTasks();
    }
    setShowTaskModal(false);
    if (soundEnabled) playSound('click');
  };

  const handleDeleteTask = async () => {
     if (!deleteTaskId) return;
     
     if (view === 'personal') {
        const newTasks = personalTasks.filter(t => t.id !== deleteTaskId);
        setPersonalTasks(newTasks);
        if (isLoggedIn) fetch('/api/user/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tasks: newTasks, order: newTasks.map(t => t.id) })});
     } else {
        const newTasks = (groupTasks || []).filter(t => t.id !== deleteTaskId);
        mutateGroupTasks(newTasks, false);
        await fetch(`/api/groups/${activeGroupId}/tasks/${deleteTaskId}`, { method: 'DELETE' });
        mutateGroupTasks();
     }
     setDeleteTaskId(null);
  };

  // --- Modal Openers ---
  const openCreateModal = () => {
    setFormTitle('');
    setFormDesc('');
    setFormType('simple');
    setCurrentTask(null);
    setIsViewingInfo(false);
    setShowTaskModal(true);
  };

  const openEditModal = (task: Task) => {
    setFormTitle(task.title);
    setFormDesc(task.description);
    setFormType(task.type || 'simple');
    setCurrentTask(task);
    setIsViewingInfo(false);
    setShowTaskModal(true);
  };

  const openInfoModal = (task: Task) => {
    setFormTitle(task.title);
    setFormDesc(task.description);
    setFormType(task.type || 'simple');
    setCurrentTask(task);
    setIsViewingInfo(true);
    setShowTaskModal(true);
  };

  const openSettings = () => {
      setTempTheme(theme);
      setTempSound(soundEnabled);
      setTempLanguage(language);
      setTempUsername(currentUser?.username || '');
      setUsernameStatus('idle');
      setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
      setSettingsError(null);
      setTheme(tempTheme);
      setSoundEnabled(tempSound);
      setLanguage(tempLanguage);
      
      if(isLoggedIn && currentUser) {
          const res = await fetch('/api/user/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  themeId: tempTheme.id, 
                  soundEnabled: tempSound, 
                  language: tempLanguage,
                  username: tempUsername !== currentUser.username ? tempUsername : undefined
              })
          });
          const data = await res.json();
          if(res.ok) {
              setCurrentUser(prev => prev ? ({ 
                  ...prev, 
                  username: data.username, 
                  settings: data.settings,
                  usernameChangeCount: tempUsername !== currentUser.username ? (prev.usernameChangeCount || 0) + 1 : prev.usernameChangeCount
              }) : null);
              addToast("Settings saved", "success");
              setShowSettingsModal(false);
          } else {
              setSettingsError(data.error || "Failed to save");
          }
      } else {
          setShowSettingsModal(false);
          addToast("Local settings saved", "success");
      }
  };

  const handleInvite = async () => {
     if(!activeGroupId || !inviteUser) return;
     
     try {
        const res = await fetch(`/api/groups/${activeGroupId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: inviteUser })
        });
        const data = await res.json();
        
        if(res.ok) {
            addToast("Invite sent!", "success");
            setInviteUser('');
        } else if (res.status === 404) {
            addToast("User not found", "error");
        } else if (res.status === 409) {
            addToast("User is already in group", "info");
        } else {
            addToast("Failed to invite", "error");
        }
     } catch (e) {
         addToast("Network error", "error");
     }
  };

  // --- Derived State for UI ---
  const completedToday = activeTasks.filter(t => t.isCompleted).length;
  const remainingChanges = MAX_USERNAME_CHANGES - (currentUser?.usernameChangeCount || 0);

  // Determine if settings have changed
  const hasSettingsChanged = 
      tempTheme.id !== theme.id || 
      tempSound !== soundEnabled || 
      tempLanguage !== language || 
      (isLoggedIn && currentUser && tempUsername !== currentUser.username && tempUsername.length >= 3);

  // Determine if we can save
  const canSave = hasSettingsChanged && usernameStatus !== 'checking' && usernameStatus !== 'taken';

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <Toast toasts={toasts} onRemove={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      {/* Sidebar (Desktop) */}
      <div className="hidden md:block h-full shrink-0">
          <Sidebar 
             currentView={view} 
             activeGroupId={activeGroupId} 
             onNavigate={handleNavigate} 
             onCreateGroup={() => setShowCreateGroup(true)}
             onOpenSettings={openSettings}
             onOpenStats={() => setShowStats(true)}
             onLogout={handleLogout}
             onLogin={() => setShowLoginModal(true)}
             currentUser={currentUser}
             themeColor={theme.hex}
             onOpenInvites={() => setShowInvites(true)}
             onOpenWhatsNew={() => setShowWhatsNew(true)}
          />
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 md:hidden" onClick={() => setSidebarOpen(false)}>
           <div className="w-64 h-full bg-zinc-900 animate-in slide-in-from-left" onClick={e => e.stopPropagation()}>
              <Sidebar 
                 currentView={view} 
                 activeGroupId={activeGroupId} 
                 onNavigate={handleNavigate} 
                 onCreateGroup={() => { setSidebarOpen(false); setShowCreateGroup(true); }}
                 onOpenSettings={() => { setSidebarOpen(false); openSettings(); }}
                 onOpenStats={() => { setSidebarOpen(false); setShowStats(true); }}
                 onLogout={() => { setSidebarOpen(false); handleLogout(); }}
                 onLogin={() => { setSidebarOpen(false); setShowLoginModal(true); }}
                 currentUser={currentUser}
                 themeColor={theme.hex}
                 onOpenInvites={() => { setSidebarOpen(false); setShowInvites(true); }}
                 onOpenWhatsNew={() => { setSidebarOpen(false); setShowWhatsNew(true); }}
              />
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <header className="flex items-center justify-between px-4 py-4 bg-zinc-950 border-b border-zinc-800 z-30 shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 bg-zinc-800 rounded-lg">
                <Menu size={20} />
             </button>
             <div className="flex flex-col">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    {view === 'personal' ? 'My Board' : 'Crew Board'}
                </h2>
                {view === 'group' && activeGroupId && (
                   <div 
                      className="text-xs text-zinc-400 font-medium cursor-pointer hover:text-white flex items-center gap-1"
                      onClick={() => setShowGroupInfo(true)}
                   >
                      <Info size={12} /> Crew Info
                   </div>
                )}
             </div>
          </div>
          <div className="flex items-center gap-2">
             {view === 'group' && (
                <div className="hidden sm:flex items-center bg-zinc-900 rounded-full px-2 border border-zinc-800 mr-2 transition-colors focus-within:border-white/50">
                   <input 
                      className="bg-transparent border-none focus:outline-none text-xs w-24 px-2 py-1.5 text-white placeholder-zinc-500"
                      placeholder="Invite user..."
                      value={inviteUser}
                      onChange={e => setInviteUser(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()}
                   />
                   <button onClick={handleInvite} className="text-zinc-500 hover:text-white transition-colors p-1"><UserPlus size={14}/></button>
                </div>
             )}
             
             {/* Edit Toggle */}
             <button 
                onClick={() => setIsReordering(!isReordering)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  isReordering 
                    ? 'bg-zinc-800 text-white border-zinc-600' 
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                {isReordering ? <Check size={14} /> : <LayoutGrid size={14} />}
                <span className="hidden sm:inline">{isReordering ? t.done : t.editGrid}</span>
              </button>

             <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-zinc-500 hover:text-white">
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
             </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Stats Slide-over */}
          <div className={`absolute inset-y-0 left-0 z-40 w-80 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ${showStats ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex flex-col h-full">
                  <div className="p-4 flex justify-end">
                      <button onClick={() => setShowStats(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                  </div>
                  <StatsPanel 
                    history={history} 
                    currentStreak={0} // TODO: implement streak calc 
                    totalCompletedToday={completedToday}
                    themeColor={theme.hex}
                  />
              </div>
          </div>

          {/* Tasks Grid */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950 relative">
             {/* Stats Overlay Backdrop */}
             {showStats && (
                 <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setShowStats(false)}></div>
             )}

             {activeTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                   <div className="w-24 h-24 border-2 border-dashed border-zinc-800 rounded-2xl flex items-center justify-center opacity-50"><Plus size={32} /></div>
                   <p>{t.noTracks}</p>
                   <button onClick={openCreateModal} className="text-sm underline hover:text-zinc-400">{t.createOne}</button>
                </div>
             ) : (
                <ReactSortable
                   list={activeTasks}
                   setList={handleSetList}
                   animation={200}
                   delay={10}
                   disabled={!isReordering}
                   ghostClass="sortable-ghost"
                   dragClass="sortable-drag"
                   className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-20"
                >
                   {activeTasks.map((task, i) => (
                      <PadItem 
                        key={task.id} 
                        index={i} 
                        task={task} 
                        themeColor={theme.hex} 
                        themeShadow={theme.shadow}
                        onToggle={handleToggleTask}
                        onEdit={openEditModal}
                        onDelete={id => setDeleteTaskId(id)}
                        onViewInfo={openInfoModal}
                        isReordering={isReordering}
                      />
                   ))}
                </ReactSortable>
             )}
             
             {!isReordering && activeTasks.length > 0 && (
                <div className="fixed bottom-6 right-6 z-20">
                    <button 
                      onClick={openCreateModal} 
                      className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
                      style={{ backgroundColor: theme.hex, boxShadow: `0 8px 30px -5px ${theme.shadow}` }}
                    >
                       <Plus size={32} />
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

      {/* --- MODALS --- */}

      <CreateGroupModal 
         isOpen={showCreateGroup} 
         onClose={() => setShowCreateGroup(false)} 
         onGroupCreated={() => mutate('/api/groups')}
         themeColor={theme.hex}
      />
      
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={(u) => { setCurrentUser(u); setShowLoginModal(false); }} themeColor={theme.hex} />
      
      <DeleteModal 
        isOpen={!!deleteTaskId} 
        onClose={() => setDeleteTaskId(null)} 
        onConfirm={handleDeleteTask} 
        taskTitle={activeTasks.find(t => t.id === deleteTaskId)?.title}
      />

      <WhatsNewModal isOpen={showWhatsNew} onClose={() => { setShowWhatsNew(false); localStorage.setItem('groovetask_version', APP_VERSION); }} themeColor={theme.hex} />
      
      {activeGroupId && (
         <GroupInfoModal 
            isOpen={showGroupInfo}
            onClose={() => setShowGroupInfo(false)}
            groupId={activeGroupId}
            themeColor={theme.hex}
         />
      )}

      <InvitesModal 
         isOpen={showInvites}
         onClose={() => setShowInvites(false)}
         themeColor={theme.hex}
      />

      {/* Task Creation/Edit/Info Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                   <h2 className="text-xl font-bold flex items-center gap-2">
                      {isViewingInfo ? <Info className="text-zinc-500"/> : null}
                      {isViewingInfo ? t.trackDetails : (currentTask ? t.remixTrack : t.newTrack)}
                   </h2>
                   <button onClick={() => setShowTaskModal(false)} className="text-zinc-500 hover:text-white"><X size={24}/></button>
                </div>

                {isViewingInfo ? (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">{t.title}</h3>
                            <p className="text-lg text-white font-medium">{formTitle}</p>
                        </div>
                        {currentTask?.type === 'counter' && (
                           <div className="bg-zinc-950/50 rounded-xl border border-zinc-800 overflow-hidden">
                               <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-800 flex justify-between items-center">
                                   <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t.history}</span>
                                   <span className="text-xs font-mono text-zinc-500">Total: {currentTask.count}</span>
                               </div>
                               <div className="max-h-[150px] overflow-y-auto p-2">
                                   {currentTask.log?.map((l: any) => (
                                       <div key={l.id} className="text-xs text-zinc-400 py-1 px-2 border-b border-zinc-800/50 last:border-0 flex justify-between">
                                           <span>{new Date(l.timestamp).toLocaleString()}</span>
                                       </div>
                                   ))}
                                   {(!currentTask.log || currentTask.log.length === 0) && <div className="text-center text-zinc-600 text-xs py-2">{t.noHistory}</div>}
                               </div>
                           </div>
                        )}
                        <div>
                           <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">{t.details}</h3>
                           <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800 min-h-[100px] text-zinc-300 whitespace-pre-wrap">
                               {formDesc || "No details."}
                           </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                             <button onClick={() => setIsViewingInfo(false)} className="text-sm text-zinc-400 hover:text-white underline">{t.editTrack}</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {!currentTask && (
                           <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 mb-4">
                               <button type="button" onClick={() => setFormType('simple')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold ${formType === 'simple' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>{t.simpleTrack}</button>
                               <button type="button" onClick={() => setFormType('counter')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold ${formType === 'counter' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>{t.counterTrack}</button>
                           </div>
                        )}
                        <div>
                           <label className="block text-sm font-medium text-zinc-400 mb-1">{t.title}</label>
                           <input autoFocus value={formTitle} onChange={e => setFormTitle(e.target.value)} maxLength={50} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-zinc-600" style={{ borderColor: theme.hex }} />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-zinc-400 mb-1">{t.description}</label>
                           <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-zinc-600" style={{ borderColor: theme.hex }} />
                        </div>
                        <div className="pt-4 flex gap-3">
                           <button onClick={() => setShowTaskModal(false)} className="flex-1 py-3 rounded-xl font-medium text-zinc-400 hover:bg-zinc-800">{t.cancel}</button>
                           <button onClick={currentTask ? handleUpdateTask : handleCreateTask} disabled={!formTitle.trim()} className="flex-1 py-3 rounded-xl font-bold text-white transition-transform hover:scale-[1.02]" style={{ backgroundColor: theme.hex }}>{currentTask ? t.update : t.create}</button>
                        </div>
                    </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettingsModal(false)}>
             <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                 <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">{t.studioSettings}</h2>
                    <button onClick={() => setShowSettingsModal(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                 </div>
                 
                 {/* Username */}
                 {isLoggedIn && (
                     <div className="mb-6">
                         <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{t.username}</h3>
                         <div className="flex flex-col gap-2">
                             <div className="relative">
                                 <input 
                                   value={tempUsername} 
                                   onChange={e => setTempUsername(e.target.value)} 
                                   className={`w-full bg-zinc-950 border rounded-xl p-3 pr-10 text-white focus:outline-none ${usernameStatus === 'taken' ? 'border-red-500' : 'border-zinc-800 focus:border-white'}`}
                                   disabled={remainingChanges <= 0}
                                 />
                                 <div className="absolute right-3 top-3.5">
                                    {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-zinc-400" />}
                                    {usernameStatus === 'available' && <Check size={16} className="text-green-500" />}
                                    {usernameStatus === 'taken' && <X size={16} className="text-red-500" />}
                                 </div>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                                 <span className={`${remainingChanges <= 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                                    {remainingChanges} {t.changesRemaining}
                                 </span>
                                 {usernameStatus === 'taken' && <span className="text-red-500 font-bold ml-auto">{t.usernameTaken}</span>}
                                 {usernameStatus === 'available' && <span className="text-green-500 font-bold ml-auto">Available</span>}
                                 {remainingChanges <= 0 && usernameStatus !== 'taken' && usernameStatus !== 'available' && <span className="text-red-500 font-bold">Limit Reached</span>}
                             </div>
                         </div>
                     </div>
                 )}

                 {/* Language */}
                 <div className="mb-6">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{t.language}</h3>
                     <div className="space-y-2">
                        {(Object.keys(LANGUAGE_NAMES) as LanguageCode[]).map((code) => (
                           <button key={code} onClick={() => setTempLanguage(code)} className={`w-full flex items-center justify-between p-3 rounded-xl border ${tempLanguage === code ? 'bg-zinc-800 border-zinc-600' : 'border-transparent hover:bg-zinc-800/50'}`}>
                              <span className="text-sm text-zinc-300">{LANGUAGE_NAMES[code]}</span>
                              {tempLanguage === code && <Check size={16} color={tempTheme.hex} />}
                           </button>
                        ))}
                     </div>
                 </div>

                 {/* Theme */}
                 <div className="mb-6">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{t.lighting}</h3>
                     <div className="grid grid-cols-4 gap-2">
                         {THEME_COLORS.map(c => (
                             <button 
                                key={c.id} 
                                onClick={() => setTempTheme(c)} 
                                className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${tempTheme.id === c.id ? 'border-white scale-105' : 'border-transparent hover:bg-zinc-800'}`}
                                style={{
                                    boxShadow: tempTheme.id === c.id ? `0 0 20px ${c.shadow}` : 'none'
                                }}
                             >
                                 <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: c.hex }} />
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* Sound */}
                 <div className="mb-6">
                     <button onClick={() => setTempSound(!tempSound)} className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950">
                         <span className="text-sm font-medium text-zinc-300">{t.soundEffects}</span>
                         <div className={`w-10 h-6 rounded-full relative transition-colors ${tempSound ? 'bg-green-500/20' : 'bg-zinc-800'}`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${tempSound ? 'left-5 bg-green-500' : 'left-1'}`} />
                         </div>
                     </button>
                 </div>
                 
                 {settingsError && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-200 text-xs mb-4">{settingsError}</div>}

                 <button 
                    onClick={handleSaveSettings} 
                    disabled={!canSave}
                    className="w-full py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" 
                    style={{ 
                        backgroundColor: canSave ? tempTheme.hex : '#3f3f46',
                        boxShadow: canSave ? `0 0 20px ${tempTheme.shadow}` : 'none'
                    }}
                 >
                    {t.saveChanges}
                 </button>
             </div>
         </div>
      )}
    </div>
  );
}

export default App;