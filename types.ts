
export type TaskType = 'simple' | 'counter';

export interface LogEntry {
  id: string;
  timestamp: number;
}

export interface Task {
  id: string;
  groupId?: string; // Optional: if belongs to a group
  type?: TaskType; 
  title: string;
  description: string;
  
  // Simple Track Props
  isCompleted: boolean;
  completedAt: number | null; 
  
  // Counter Track Props
  count?: number;
  log?: LogEntry[];

  createdAt: number;
  updatedBy?: string; // Username of last editor
}

export interface DailyStat {
  date: string; 
  completedCount: number;
  totalTasksAtEnd: number;
}

export interface AppState {
  tasks: Task[];
  history: DailyStat[];
}

export interface ThemeColor {
  id: string;
  name: string;
  hex: string;
  shadow: string; 
}

export interface UserSettings {
  themeId: string;
  soundEnabled: boolean;
  language?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  usernameChangeCount: number;
  createdAt: number;
  settings: UserSettings;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  memberCount?: number;
}

export interface GroupMember {
  id: string;
  username: string;
  role: 'owner' | 'member';
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string; // Username
  text: string;
  timestamp: number;
  isSystem?: boolean;
}
