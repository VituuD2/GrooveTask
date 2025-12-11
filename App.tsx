import React, { useState, useEffect, useRef } from 'react';
import { Plus, Settings, Volume2, VolumeX, Menu, X, Info, User, LogOut, Globe, Check, LayoutGrid, Save, Edit2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
// Fix for "does not provide an export named 'ReactSortable'" error
import ReactSortablePkg from 'react-sortablejs';

// Handle both CJS (default export with properties) and ESM (named exports or default component) scenarios
const ReactSortable = (ReactSortablePkg as any).ReactSortable || ReactSortablePkg;

import { Task, AppState, DailyStat, ThemeColor } from './types';
import { THEME_COLORS, STORAGE_KEY, THEME_KEY, APP_VERSION } from './constants';
import { playSound } from './services/audio';
import { useLanguage } from './contexts/LanguageContext';
import { LANGUAGE_NAMES, LanguageCode } from './translations';

import PadItem from './components/PadItem';
import StatsPanel from './components/StatsPanel';
import DeleteModal from './components/DeleteModal';
import LoginModal from './components/LoginModal';
import Toast, { ToastMessage, ToastType } from './components/Toast';

// --- Helper Functions ---
const getToday = () => new Date().toISOString().split('T')[0];

const INITIAL_STATE: AppState = {
  tasks: [],
  history: []
};

function App() {
  const { t, language, setLanguage } = useLanguage();

  // --- State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<DailyStat[]>([]);
  const [theme, setTheme] = useState<ThemeColor>(THEME_COLORS[0]);
  
  // Initialize sound from local storage
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('groovetask_sound');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameChangeCount, setUsernameChangeCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // UI State
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isReordering, setIsReordering] = useState(false); // Edit Mode
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Settings Temporary State (for the Save button logic)
  const [tempTheme, setTempTheme] = useState<ThemeColor>(THEME_COLORS[0]);
  const [tempSound, setTempSound] = useState(true);
  const [tempLanguage, setTempLanguage] = useState<LanguageCode>('en');
  const [tempUsername, setTempUsername] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Delete Modal State
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  
  // Edit/View State
  const [currentTask, setCurrentTask] = useState<Task | null>(null); // For editing/viewing
  const [isViewingInfo, setIsViewingInfo] = useState(false); // Mode: View vs Edit
  
  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // Refs for debouncing and syncing
  const settingsSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdate = useRef(false);
  const tasksRef = useRef<Task[]>(tasks); // Ref to track tasks for Sortable onEnd

  // --- Dynamic Favicon Effect ---
  useEffect(() => {
    const updateFavicon = () => {
      const encodedColor = encodeURIComponent(theme.hex);
      const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
          <rect width='100' height='100' fill='%2318181b' rx='20'/>
          <rect x='25' y='25' width='50' height='50' fill='${encodedColor}' rx='10'/>
          <circle cx='75' cy='25' r='5' fill='%2352525b'/>
        </svg>
      `.trim().replace(/\s+/g, ' ');

      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      
      link.type = 'image/svg+xml';
      link.href = `data:image/svg+xml,${svg}`;
    };

    updateFavicon();
  }, [theme]);

  // --- Initialization & Storage ---
  useEffect(() => {
    // 1. Check Auth Session
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.isAuthenticated) {
            setIsLoggedIn(true);
            setUserEmail(data.user?.email || 'User');
            setUsername(data.user?.username || 'Artist');
            setUsernameChangeCount(data.user?.usernameChangeCount || 0);
            
            if (data.user?.settings) {
               applySettings(data.user.settings);
            }
            if (data.user?.data) {
               applyRemoteData(data.user.data);
            }
          }
        }
      } catch (error) {
        console.debug('Auth check failed (backend might be offline)');
      }
    };
    checkAuth();

    // 2. Load Local Theme
    const savedThemeId = localStorage.getItem(THEME_KEY);
    if (savedThemeId) {
      const found = THEME_COLORS.find(t => t.id === savedThemeId);
      if (found) setTheme(found);
    }

    // 3. Load Local Data (Tasks) as fallback/initial
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsed: AppState = JSON.parse(savedData);
      // Migration for local storage old format
      const migratedTasks = parsed.tasks.map((t: any) => ({
        ...t,
        completedAt: t.completedAt !== undefined ? t.completedAt : (t.lastCompletedDate ? new Date(t.lastCompletedDate).getTime() : null),
        lastCompletedDate: undefined // Remove old field
      }));
      applyResetLogic(migratedTasks, parsed.history);
    } else {
      setTasks(INITIAL_STATE.tasks);
      setHistory(INITIAL_STATE.history);
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      const todayStr = getToday();
      setTasks(currentTasks => {
        const needsReset = currentTasks.some(t => {
           if (!t.isCompleted || !t.completedAt) return false;
           const taskDate = new Date(t.completedAt).toISOString().split('T')[0];
           return taskDate !== todayStr;
        });

        if (needsReset) {
          return currentTasks.map(t => {
            if (t.isCompleted && t.completedAt) {
               const taskDate = new Date(t.completedAt).toISOString().split('T')[0];
               if (taskDate !== todayStr) {
                  return { ...t, isCompleted: false, completedAt: null };
               }
            }
            return t;
          });
        }
        return currentTasks;
      });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Update ref whenever tasks change
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // --- Data Logic Helpers ---
  
  const applyResetLogic = (loadedTasks: Task[], loadedHistory: DailyStat[]) => {
      const todayStr = getToday();
      const updatedTasks = loadedTasks.map(t => {
        if (t.isCompleted && t.completedAt) {
          const taskDate = new Date(t.completedAt).toISOString().split('T')[0];
          if (taskDate !== todayStr) {
             return { ...t, isCompleted: false, completedAt: null };
          }
        }
        return t;
      });
      setTasks(updatedTasks);
      setHistory(loadedHistory);
  };

  const applyRemoteData = (data: { tasks: Task[], history: DailyStat[] }) => {
     if (data && (data.tasks.length > 0 || data.history.length > 0)) {
         isRemoteUpdate.current = true;
         applyResetLogic(data.tasks, data.history);
     }
  };

  const applySettings = (settings: any) => {
     if (settings.themeId) {
         const foundTheme = THEME_COLORS.find(t => t.id === settings.themeId);
         if (foundTheme) setTheme(foundTheme);
     }
     if (typeof settings.soundEnabled === 'boolean') {
         setSoundEnabled(settings.soundEnabled);
     }
     if (settings.language) {
         setLanguage(settings.language as LanguageCode);
     }
  };

  // --- Toasts Helper ---
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Async Sync Handler ---
  // Called for Content Updates (Creates/Edits/Deletes)
  const persistData = async (newTasks: Task[], newHistory: DailyStat[]) => {
    // 1. Save Local Storage Always
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: newTasks, history: newHistory }));

    // 2. Sync Remote if Logged In
    if (isLoggedIn && !isRemoteUpdate.current) {
       try {
         const order = newTasks.map(t => t.id); // Extract order
         const res = await fetch('/api/user/data', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ tasks: newTasks, history: newHistory, order }) // Send order too
         });
         if (!res.ok) throw new Error("Sync failed");
       } catch (err) {
         throw err;
       }
    }
  };

  // Called ONLY for Reordering (Optimized payload)
  const persistOrderOnly = async (newTasks: Task[]) => {
      // Update local storage to stay in sync
      const currentHistory = history; 
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: newTasks, history: currentHistory }));
      
      if (isLoggedIn && !isRemoteUpdate.current) {
          try {
            const order = newTasks.map(t => t.id);
            const res = await fetch('/api/user/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order }) // ONLY SEND ORDER
            });
            if (!res.ok) throw new Error("Order sync failed");
          } catch (err) {
            throw err;
          }
      }
  };

  // --- Effects for Saving Settings Only ---
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme.id);
    localStorage.setItem('groovetask_sound', JSON.stringify(soundEnabled));
  }, [theme, soundEnabled, language]);

  // --- Event Handlers ---

  const handleOpenSettings = () => {
    // Initialize temp state with current state
    setTempTheme(theme);
    setTempSound(soundEnabled);
    setTempLanguage(language);
    setTempUsername(username || '');
    setSettingsError(null);
    setShowSettingsModal(true);
  };

  const hasSettingsChanged = 
    tempTheme.id !== theme.id || 
    tempSound !== soundEnabled || 
    tempLanguage !== language ||
    (tempUsername !== username && tempUsername.length > 0);

  const handleSaveSettings = async () => {
    if (!hasSettingsChanged) return;
    setSettingsError(null);
    
    // Optimistic Update for local changes
    setTheme(tempTheme);
    setSoundEnabled(tempSound);
    setLanguage(tempLanguage);

    if (isLoggedIn) {
      try {
        const res = await fetch('/api/user/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
             themeId: tempTheme.id, 
             soundEnabled: tempSound, 
             language: tempLanguage,
             username: tempUsername !== username ? tempUsername : undefined
          })
        });

        const data = await res.json();
        
        if (!res.ok) {
           setSettingsError(data.error || 'Failed to save');
           return; // Don't close modal on error
        }

        // Update username state if changed successfully
        if (data.username) {
           setUsername(data.username);
           setUsernameChangeCount(data.usernameChangeCount);
        }
        addToast("Settings saved", "success");

      } catch (err) {
        console.error("Failed to sync settings:", err);
        setSettingsError("Connection error");
        return;
      }
    }
    
    setShowSettingsModal(false);
  };

  // --- Optimistic Handlers ---

  const handleCreateTask = async () => {
    if (!formTitle.trim()) return;
    
    const prevTasks = [...tasks];
    const prevHistory = [...history];

    const newTask: Task = {
      id: uuidv4(),
      title: formTitle,
      description: formDesc,
      isCompleted: false,
      completedAt: null,
      createdAt: Date.now()
    };
    
    const newTasks = [...tasks, newTask];
    
    // 1. Optimistic Update
    setTasks(newTasks);
    closeModal();
    if (soundEnabled) playSound('click');

    // 2. Persist
    try {
      await persistData(newTasks, history);
    } catch (error) {
      // Revert on failure
      setTasks(prevTasks);
      setHistory(prevHistory);
      addToast("Failed to create task", "error");
    }
  };

  const handleUpdateTask = async () => {
    if (!currentTask || !formTitle.trim()) return;

    const prevTasks = [...tasks];
    const prevHistory = [...history];
    
    const newTasks = tasks.map(t => 
      t.id === currentTask.id 
        ? { ...t, title: formTitle, description: formDesc }
        : t
    );

    // 1. Optimistic Update
    setTasks(newTasks);
    closeModal();
    
    // 2. Persist
    try {
      await persistData(newTasks, history);
    } catch (error) {
      setTasks(prevTasks);
      setHistory(prevHistory);
      addToast("Failed to update task", "error");
    }
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTaskId(id);
  };

  const confirmDeleteTask = async () => {
    if (deleteTaskId) {
      const prevTasks = [...tasks];
      const prevHistory = [...history];

      const newTasks = tasks.filter(t => t.id !== deleteTaskId);
      
      // 1. Optimistic Update
      setTasks(newTasks);
      if (soundEnabled) playSound('click');
      setDeleteTaskId(null);

      // 2. Persist
      try {
        await persistData(newTasks, history);
      } catch (error) {
        setTasks(prevTasks);
        setHistory(prevHistory);
        addToast("Failed to delete task", "error");
      }
    }
  };

  const handleToggleTask = async (id: string) => {
    // Prevent toggling while reordering
    if (isReordering) return;

    const prevTasks = [...tasks];
    const prevHistory = [...history];

    let justFinishedAll = false;
    let newTasks = [...tasks];
    let newHistory = [...history];

    // Calculate new state
    newTasks = newTasks.map(t => {
      if (t.id === id) {
        const newState = !t.isCompleted;
        if (newState && soundEnabled) playSound('check');
        return {
          ...t,
          isCompleted: newState,
          completedAt: newState ? Date.now() : null
        };
      }
      return t;
    });

    // Check if all tasks are now completed
    const allCompleted = newTasks.length > 0 && newTasks.every(t => t.isCompleted);
    const wasAllCompleted = prevTasks.length > 0 && prevTasks.every(t => t.isCompleted);
    
    if (allCompleted && !wasAllCompleted) {
      justFinishedAll = true;
    }

    // Recalculate History (required because tasks changed)
    const todayStr = getToday();
    const completedCount = newTasks.filter(t => t.isCompleted).length;
    
    const index = newHistory.findIndex(h => h.date === todayStr);
    if (index >= 0) {
      newHistory[index] = { ...newHistory[index], completedCount, totalTasksAtEnd: newTasks.length };
    } else {
      newHistory.push({ date: todayStr, completedCount, totalTasksAtEnd: newTasks.length });
    }

    // 1. Optimistic Update
    setTasks(newTasks);
    setHistory(newHistory);

    if (justFinishedAll) {
      setTimeout(() => {
        if (soundEnabled) playSound('complete');
        setShowCongrats(true);
      }, 300);
    }

    // 2. Persist
    try {
      await persistData(newTasks, newHistory);
    } catch (error) {
      // 3. Rollback on Failure
      console.error("Sync error, rolling back");
      setTasks(prevTasks);
      setHistory(prevHistory);
      addToast("Connection failed. Action reverted.", "error");
    }
  };

  // Wrapper for Sortable setList to keep ref in sync immediately
  const handleSetList = (newList: Task[]) => {
     setTasks(newList);
     tasksRef.current = newList;
  };

  // Handle Sortable Change (Reorder)
  const handleSortEnd = async () => {
    // Use the REF current value, which contains the latest order from handleSetList
    const orderedTasks = tasksRef.current;
    
    try {
      await persistOrderOnly(orderedTasks);
    } catch (error) {
      addToast("Failed to save order", "error");
    }
  };

  // Auth Handlers
  const handleLoginSuccess = (user: any) => {
    setIsLoggedIn(true);
    setUserEmail(user.email || 'User');
    setUsername(user.username || 'Artist');
    setUsernameChangeCount(user.usernameChangeCount || 0);
    
    if (user.settings) {
        applySettings(user.settings);
    }
    
    if (user.data && (user.data.tasks.length > 0 || user.data.history.length > 0)) {
        applyRemoteData(user.data);
    } else {
        // If user has no remote data but has local data, sync up
        if (tasks.length > 0) {
            persistData(tasks, history);
        }
    }
    
    if (soundEnabled) playSound('complete');
    addToast(t.authenticating.replace('...', ' Success'), 'success');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsLoggedIn(false);
      setUserEmail(null);
      setUsername(null);
      if (soundEnabled) playSound('click');
      setTasks(INITIAL_STATE.tasks);
      setHistory(INITIAL_STATE.history);
      addToast(t.logout, 'info');
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  // --- Modals ---

  const openCreateModal = () => {
    setFormTitle('');
    setFormDesc('');
    setCurrentTask(null);
    setIsViewingInfo(false);
    setShowTaskModal(true);
  };

  const openEditModal = (task: Task) => {
    setFormTitle(task.title);
    setFormDesc(task.description);
    setCurrentTask(task);
    setIsViewingInfo(false);
    setShowTaskModal(true);
  };

  const openInfoModal = (task: Task) => {
    setFormTitle(task.title);
    setFormDesc(task.description);
    setCurrentTask(task);
    setIsViewingInfo(true);
    setShowTaskModal(true);
  };

  const closeModal = () => {
    setShowTaskModal(false);
    setCurrentTask(null);
  };

  // Stats Calculations
  const completedToday = tasks.filter(t => t.isCompleted).length;
  const calculateStreak = () => {
    let streak = 0;
    const sortedHistory = [...history].sort((a, b) => b.date.localeCompare(a.date)); // Newest first
    const today = getToday();
    
    const todayStat = sortedHistory.find(h => h.date === today);
    if (todayStat && todayStat.completedCount > 0) {
      streak++;
    }

    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1);
    
    for (let i = 0; i < sortedHistory.length; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const stat = sortedHistory.find(h => h.date === dateStr);
        if (stat && stat.completedCount >= 1) { 
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else if (stat) {
            break; 
        }
    }
    return streak;
  };

  const taskToDelete = tasks.find(t => t.id === deleteTaskId);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out ${isStatsOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:w-16 hover:md:w-80 group shadow-2xl`}
      >
        <div className="h-full w-full bg-zinc-900 border-r border-zinc-800 md:w-16 md:group-hover:w-80 transition-all duration-300 overflow-hidden relative">
           <div className="absolute left-0 top-0 w-16 h-full flex flex-col items-center py-6 gap-8 z-10 bg-zinc-900 md:bg-transparent pointer-events-none md:pointer-events-auto">
              <button onClick={() => setIsStatsOpen(!isStatsOpen)} className="md:hidden p-2 bg-zinc-800 rounded-lg pointer-events-auto">
                <X size={20} />
              </button>
              <div className="hidden md:block">
                 <Menu size={24} className="text-zinc-500 group-hover:text-white transition-colors" />
              </div>
              
              <button 
                onClick={() => isLoggedIn ? handleLogout() : setShowLoginModal(true)}
                className={`hidden md:flex p-2 rounded-full transition-colors pointer-events-auto ${isLoggedIn ? '' : 'text-zinc-500 hover:text-white'}`}
                style={isLoggedIn ? { color: theme.hex, backgroundColor: `${theme.hex}20` } : {}}
                title={isLoggedIn ? t.logout : t.logIn}
              >
                 {isLoggedIn ? <User size={24} /> : <User size={24} />}
              </button>

              <div className="mt-auto flex flex-col gap-4 mb-4 pointer-events-auto">
                 <button onClick={handleOpenSettings} className="p-2 text-zinc-500 hover:text-white transition-colors">
                    <Settings size={24} />
                 </button>
                 <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                    {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                 </button>
              </div>
           </div>

           {/* Expanded Content */}
           <div className="w-80 h-full pl-16 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 delay-75 flex flex-col">
             
             <div className="p-6 pb-2 border-b border-zinc-800/50">
                {isLoggedIn ? (
                  <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div 
                        className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center font-bold text-xs border shadow-sm transition-all"
                        style={{ borderColor: theme.hex, color: theme.hex, boxShadow: `0 0 8px ${theme.shadow}` }}
                      >
                        {username ? username[0].toUpperCase() : 'U'}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs text-zinc-400">{t.signedInAs}</span>
                        <span className="text-sm font-medium text-white truncate max-w-[120px]">{username}</span>
                      </div>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                      title={t.logout}
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowLoginModal(true)}
                    className="w-full py-3 rounded-xl font-bold bg-zinc-100 text-zinc-900 hover:bg-white transition-colors flex items-center justify-center gap-2"
                  >
                    <User size={18} />
                    {t.loginSync}
                  </button>
                )}
             </div>

             <div className="flex-1 overflow-y-auto">
                <StatsPanel 
                  history={history} 
                  currentStreak={calculateStreak()} 
                  totalCompletedToday={completedToday}
                  themeColor={theme.hex}
                />
             </div>
             
             <div className="p-4 text-xs text-zinc-600 text-center border-t border-zinc-800/50 font-mono">
               {APP_VERSION}
             </div>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-6 bg-zinc-950/90 backdrop-blur-sm z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsStatsOpen(true)} className="md:hidden p-2 bg-zinc-800 rounded-full text-zinc-400">
              <Menu size={20} />
            </button>
            <h1 className="text-2xl font-bold tracking-tighter">
              GROOVE<span style={{ color: theme.hex }}>{t.appName}</span>
            </h1>
          </div>
          <div className="flex gap-2">
            {/* Edit Grid Toggle Button */}
            <button 
                onClick={() => setIsReordering(!isReordering)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all border ${
                  isReordering 
                    ? 'bg-zinc-800 text-white border-zinc-600' 
                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-900'
                }`}
              >
                {isReordering ? <Check size={18} /> : <LayoutGrid size={18} />}
                <span className="hidden sm:inline">{isReordering ? t.done : t.editGrid}</span>
              </button>

            <button 
              onClick={openCreateModal}
              disabled={isReordering}
              className={`flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-full font-semibold transition-all shadow-lg shadow-zinc-500/10 ${
                isReordering ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white hover:scale-105'
              }`}
            >
              <Plus size={18} />
              <span className="hidden sm:inline">{t.addTrack}</span>
            </button>
          </div>
        </header>

        {/* Grid Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 touch-pan-y">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4">
              <div className="w-24 h-24 border-2 border-dashed border-zinc-800 rounded-2xl flex items-center justify-center">
                <Plus size={32} className="opacity-50"/>
              </div>
              <p>{t.noTracks}</p>
              <button onClick={openCreateModal} className="text-sm underline hover:text-zinc-400">{t.createOne}</button>
            </div>
          ) : (
            <>
              {isReordering ? (
                <ReactSortable
                  list={tasks}
                  setList={handleSetList}
                  animation={200}
                  delay={0}
                  onEnd={handleSortEnd}
                  ghostClass="sortable-ghost"
                  dragClass="sortable-drag"
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4 auto-rows-min pb-24"
                >
                  {tasks.map((task, index) => (
                    <PadItem 
                      key={task.id} 
                      index={index}
                      task={task} 
                      themeColor={theme.hex} 
                      themeShadow={theme.shadow}
                      onToggle={handleToggleTask}
                      onEdit={openEditModal}
                      onDelete={handleDeleteRequest}
                      onViewInfo={openInfoModal}
                      isReordering={true}
                    />
                  ))}
                </ReactSortable>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4 auto-rows-min pb-24">
                  {tasks.map((task, index) => (
                    <PadItem 
                      key={task.id} 
                      index={index}
                      task={task} 
                      themeColor={theme.hex} 
                      themeShadow={theme.shadow}
                      onToggle={handleToggleTask}
                      onEdit={openEditModal}
                      onDelete={handleDeleteRequest}
                      onViewInfo={openInfoModal}
                      isReordering={false}
                    />
                  ))}
                  
                  <button 
                    key="create-btn"
                    onClick={openCreateModal}
                    className="static-btn aspect-square rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
                  >
                    <Plus size={24} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    <span className="text-zinc-700 font-medium group-hover:text-zinc-400 transition-colors text-xs">{t.create}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Task Modal (Create / Edit / Info) */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform scale-100 transition-all">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                   {isViewingInfo ? <Info className="text-zinc-500"/> : null}
                   {isViewingInfo ? t.trackDetails : (currentTask ? t.remixTrack : t.newTrack)}
                </h2>
                <button onClick={closeModal} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {isViewingInfo ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">{t.title}</h3>
                    <p className="text-lg text-white font-medium">{formTitle}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">{t.details}</h3>
                    <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800 min-h-[100px] text-zinc-300 whitespace-pre-wrap">
                      {formDesc || "No additional details provided."}
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end">
                     <button 
                       onClick={() => { setIsViewingInfo(false); }}
                       className="text-sm text-zinc-400 hover:text-white underline"
                     >
                       {t.editTrack}
                     </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">{t.title}</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      maxLength={50}
                      placeholder={t.titlePlaceholder}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
                      style={{ '--tw-ring-color': theme.hex } as React.CSSProperties}
                    />
                    <p className="text-xs text-right text-zinc-600 mt-1">{formTitle.length}/50</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">{t.description}</label>
                    <textarea 
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder={t.descPlaceholder}
                      rows={4}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 resize-none"
                      style={{ '--tw-ring-color': theme.hex } as React.CSSProperties}
                    />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button 
                      onClick={closeModal}
                      className="flex-1 py-3 rounded-xl font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      onClick={currentTask ? handleUpdateTask : handleCreateTask}
                      disabled={!formTitle.trim()}
                      className="flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: theme.hex, boxShadow: `0 4px 14px ${theme.shadow}` }}
                    >
                      {currentTask ? t.update : t.create}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <DeleteModal 
        isOpen={!!deleteTaskId} 
        onClose={() => setDeleteTaskId(null)} 
        onConfirm={confirmDeleteTask}
        taskTitle={taskToDelete?.title}
      />

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        themeColor={theme.hex}
      />

      {/* Studio Settings Modal (Replaces Theme Picker) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettingsModal(false)}>
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">{t.studioSettings}</h2>
                <button onClick={() => setShowSettingsModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
             </div>

             {/* Username Section (Only if logged in) */}
             {isLoggedIn && (
               <div className="mb-8">
                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                   <Edit2 size={14} /> {t.username}
                 </h3>
                 <div className="space-y-2">
                   <div className="relative">
                      <input 
                        type="text"
                        value={tempUsername}
                        onChange={(e) => setTempUsername(e.target.value.trim())}
                        placeholder={t.usernamePlaceholder}
                        disabled={usernameChangeCount >= 3}
                        className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 ${usernameChangeCount >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={{ '--tw-ring-color': tempTheme.hex } as React.CSSProperties}
                      />
                      {usernameChangeCount >= 3 && (
                        <div className="absolute right-3 top-3.5 text-xs text-red-500 font-medium">Max changes</div>
                      )}
                   </div>
                   <div className="flex justify-between text-xs text-zinc-500">
                      <span>{t.changesRemaining}: <span className="text-white font-medium">{Math.max(0, 3 - usernameChangeCount)}</span></span>
                      {tempUsername.length > 0 && tempUsername.length < 3 && <span className="text-red-500">{t.usernameInvalid}</span>}
                   </div>
                 </div>
               </div>
             )}

             {/* Language Section */}
             <div className="mb-8">
               <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                 <Globe size={14} /> {t.language}
               </h3>
               <div className="space-y-2">
                 {(Object.keys(LANGUAGE_NAMES) as LanguageCode[]).map((code) => (
                   <button
                     key={code}
                     onClick={() => setTempLanguage(code)}
                     className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${tempLanguage === code ? 'bg-zinc-800 border border-zinc-700' : 'hover:bg-zinc-800/50 border border-transparent'}`}
                   >
                     <span className="text-sm text-zinc-300">{LANGUAGE_NAMES[code]}</span>
                     {tempLanguage === code && <Check size={16} style={{ color: tempTheme.hex }} />}
                   </button>
                 ))}
               </div>
             </div>

             {/* Lighting Section */}
             <div className="mb-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Settings size={14} /> {t.lighting}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    {THEME_COLORS.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setTempTheme(c)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${tempTheme.id === c.id ? 'bg-zinc-800 border-zinc-600' : 'border-zinc-800 hover:bg-zinc-800'}`}
                      >
                        <div className="w-8 h-8 rounded-full shadow-lg" style={{ backgroundColor: c.hex, boxShadow: `0 0 10px ${c.shadow}` }} />
                        <span className="text-[10px] font-medium text-zinc-400">{c.name}</span>
                      </button>
                    ))}
                </div>
             </div>

             {/* Sound Section */}
             <div className="mb-8">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                   <Volume2 size={14} /> {t.soundEffects}
                </h3>
                <button 
                  onClick={() => setTempSound(!tempSound)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${tempSound ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-950 border-zinc-800'}`}
                >
                  <span className="text-sm text-zinc-300">{tempSound ? 'On' : 'Off'}</span>
                  <div className={`w-10 h-6 rounded-full relative transition-colors ${tempSound ? 'bg-green-500/20' : 'bg-zinc-700'}`}>
                     <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${tempSound ? 'left-5 bg-green-500' : 'left-1'}`} />
                  </div>
                </button>
             </div>

             {/* Error Message */}
             {settingsError && (
               <div className="mb-4 text-xs text-red-400 bg-red-500/10 p-2 rounded-lg text-center">
                 {settingsError}
               </div>
             )}

             {/* Save Button */}
             <button
                onClick={handleSaveSettings}
                disabled={!hasSettingsChanged || (tempUsername.length > 0 && tempUsername.length < 3)}
                className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                  hasSettingsChanged && !(tempUsername.length > 0 && tempUsername.length < 3)
                    ? 'text-white hover:scale-[1.02] active:scale-[0.98]' 
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                }`}
                style={hasSettingsChanged && !(tempUsername.length > 0 && tempUsername.length < 3) ? { backgroundColor: tempTheme.hex, boxShadow: `0 4px 14px ${tempTheme.shadow}` } : {}}
              >
                <Save size={18} />
                {t.saveChanges}
              </button>

           </div>
        </div>
      )}

      {/* Congrats Modal */}
      {showCongrats && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in duration-300">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 text-center max-w-sm shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))]" style={{ '--tw-gradient-from': theme.hex, '--tw-gradient-to': 'transparent' } as React.CSSProperties}></div>
            
            <div className="relative z-10 space-y-6">
              <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-zinc-800 border-4 border-zinc-700 shadow-xl" style={{ borderColor: theme.hex }}>
                <Volume2 size={40} style={{ color: theme.hex }} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">{t.mixComplete}</h2>
                <p className="text-zinc-400">{t.clearedDeck}</p>
              </div>
              <button 
                onClick={() => setShowCongrats(false)}
                className="w-full py-3 rounded-xl font-bold text-zinc-900 transition-transform hover:scale-105"
                style={{ backgroundColor: theme.hex }}
              >
                {t.keepGroovin}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;