import { ThemeColor } from "./types";

export const THEME_COLORS: ThemeColor[] = [
  { id: 'neon-blue', name: 'Cyber Blue', hex: '#06b6d4', shadow: 'rgba(6, 182, 212, 0.5)' }, // cyan-500
  { id: 'neon-purple', name: 'Synth Purple', hex: '#a855f7', shadow: 'rgba(168, 85, 247, 0.5)' }, // purple-500
  { id: 'neon-green', name: 'Acid Green', hex: '#22c55e', shadow: 'rgba(34, 197, 94, 0.5)' }, // green-500
  { id: 'neon-pink', name: 'Hot Pink', hex: '#ec4899', shadow: 'rgba(236, 72, 153, 0.5)' }, // pink-500
  { id: 'neon-orange', name: 'Sunset Orange', hex: '#f97316', shadow: 'rgba(249, 115, 22, 0.5)' }, // orange-500
  { id: 'neon-red', name: 'High Alert', hex: '#ef4444', shadow: 'rgba(239, 68, 68, 0.5)' }, // red-500
  { id: 'neon-yellow', name: 'Voltage', hex: '#eab308', shadow: 'rgba(234, 179, 8, 0.5)' }, // yellow-500
  { id: 'classic-white', name: 'Studio White', hex: '#e4e4e7', shadow: 'rgba(228, 228, 231, 0.3)' }, // zinc-200
];

export const STORAGE_KEY = 'groovetask_data';
export const THEME_KEY = 'groovetask_theme';
export const APP_VERSION = 'v0.2.0-beta';