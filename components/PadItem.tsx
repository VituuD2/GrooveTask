import React, { useState } from 'react';
import { MoreVertical, Info, Check, Play, X, GripVertical } from 'lucide-react';
import { Task } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface PadItemProps {
  task: Task;
  index: number;
  themeColor: string;
  themeShadow: string;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onViewInfo: (task: Task) => void;
  onPointerDown: (e: React.PointerEvent, task: Task, index: number) => void;
  isDragging?: boolean;
  isGhost?: boolean;
  style?: React.CSSProperties;
}

const PadItem: React.FC<PadItemProps> = ({
  task,
  index,
  themeColor,
  themeShadow,
  onToggle,
  onEdit,
  onDelete,
  onViewInfo,
  onPointerDown,
  isDragging = false,
  isGhost = false,
  style = {}
}) => {
  const { t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div 
      data-index={index}
      onPointerDown={(e) => {
        // Prevent default only if it's the specific grip handle or we decide to block standard touch behavior
        if (!showMenu) onPointerDown(e, task, index);
      }}
      className={`
        pad-item relative group aspect-square rounded-2xl transition-transform duration-200 ease-out
        flex flex-col justify-between p-4 cursor-pointer overflow-hidden
        border-2 select-none
        ${isGhost ? 'ghost-item scale-105 bg-zinc-800' : ''}
        ${isDragging ? 'opacity-30' : 'opacity-100'}
        ${task.isCompleted 
          ? 'bg-zinc-900 scale-[0.98]' 
          : 'bg-zinc-800 hover:bg-zinc-750 hover:-translate-y-1 hover:shadow-xl'
        }
      `}
      style={{
        borderColor: task.isCompleted ? themeColor : 'transparent',
        boxShadow: task.isCompleted ? `0 0 20px ${themeShadow}` : 'none',
        ...style
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.action-btn')) return;
        if ((e.target as HTMLElement).closest('.menu-container')) return;
        onToggle(task.id);
      }}
    >
      {/* Order Badge */}
      <div className="absolute top-4 right-4 text-xs font-bold text-zinc-600 bg-zinc-900/50 px-2 py-0.5 rounded-full z-0 group-hover:opacity-0 transition-opacity">
        #{index + 1}
      </div>

      {/* Drag Grip (Visible on Hover/Ghost) */}
      <div className="absolute top-4 left-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
         <GripVertical size={16} />
      </div>

      {/* Content */}
      <div className="mt-auto z-10 relative">
         <div className="flex items-end justify-between gap-2">
            <h3 className={`font-bold text-lg leading-tight line-clamp-2 ${task.isCompleted ? 'text-zinc-500 line-through decoration-2' : 'text-white'}`} style={{ textDecorationColor: task.isCompleted ? themeColor : undefined }}>
               {task.title}
            </h3>
            
            <div 
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all ${task.isCompleted ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900/50 border-zinc-700'}`}
              style={{ borderColor: task.isCompleted ? themeColor : undefined, color: task.isCompleted ? themeColor : '#71717a' }}
            >
              {task.isCompleted ? <Check size={16} strokeWidth={3} /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
            </div>
         </div>
         {task.description && (
            <div className="mt-1 flex items-center gap-1">
               <div className="h-1 w-1 rounded-full bg-zinc-600" />
               <span className="text-[10px] text-zinc-500 font-medium truncate max-w-full">{t.viewDetails}</span>
            </div>
         )}
      </div>

      {/* Menu Button */}
      <button 
        onClick={(e) => {
           e.stopPropagation();
           setShowMenu(!showMenu);
        }}
        className="action-btn absolute top-2 right-2 p-2 text-zinc-600 hover:text-white rounded-lg hover:bg-zinc-700/50 opacity-0 group-hover:opacity-100 transition-all z-20"
      >
        <MoreVertical size={16} />
      </button>

      {/* Menu Dropdown */}
      {showMenu && (
        <div className="menu-container absolute top-10 right-2 w-32 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
           <button 
             onClick={() => { setShowMenu(false); onViewInfo(task); }}
             className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
           >
             <Info size={12} /> {t.viewDetails}
           </button>
           <button 
             onClick={() => { setShowMenu(false); onEdit(task); }}
             className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
           >
             <span className="w-3 h-3 flex items-center justify-center border border-zinc-500 rounded-[2px] text-[8px]">E</span> {t.edit}
           </button>
           <div className="h-px bg-zinc-800 my-1" />
           <button 
             onClick={() => { setShowMenu(false); onDelete(task.id); }}
             className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2"
           >
             <X size={12} /> {t.delete}
           </button>
        </div>
      )}

      {/* Backdrop for Menu */}
      {showMenu && (
         <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
      )}
    </div>
  );
};

export default PadItem;