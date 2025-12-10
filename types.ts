export interface Task {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  lastCompletedDate: string | null; // Format YYYY-MM-DD
  createdAt: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
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
  shadow: string; // Tailwind class equivalent for shadow color if needed, or hex
}
