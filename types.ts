export interface Task {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  completedAt: number | null; // Timestamp
  createdAt: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD (Keep string for chart grouping)
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
