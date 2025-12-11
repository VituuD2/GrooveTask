import React, { useState } from 'react';
import { MoreVertical, Info, Check, Play, X, GripVertical, Move, Plus } from 'lucide-react';
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
  style?: React.CSSProperties;
  isReordering?: boolean; // New prop
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
  style = {},
  isReordering = false
}) => {
  const { t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const isCounter = task.type === 'counter';
  
  // For counter, "active" means explicitly recently updated or just visually distinct.
  // Actually, counters don't have a "completed" state in the same way, but let's use isCompleted for visual feedback if needed.
  // Standardizing: Simple tracks use isCompleted. Counter tracks always look "active" but show count.
  const isActiveSimple = !isCounter && task.isCompleted;

  return (
    <div 
      data-index={index}
      className={`
        pad-item relative group aspect-square rounded-xl transition-all duration-200 ease-out
        flex flex-col justify-between p-2.5 overflow-hidden border-2 select-none
        ${isReordering ? 'cursor-move edit-mode-shake' : 'cursor-pointer'}
        ${isActiveSimple 
          ? 'bg-zinc-900 scale-[0.98]' 
          : 'bg-zinc-800 hover:bg-zinc-750'
        }
        ${!isReordering && !isActiveSimple ? 'hover:-translate-y-1 hover:shadow-xl' : ''}
      `}
      style={{
        borderColor: isActiveSimple || (isCounter && (task.count || 0) > 0) ? themeColor : isReordering ? '#52525b' : 'transparent',
        boxShadow: isActiveSimple ? `0 0 20px ${themeShadow}` : 'none',
        ...style
      }}
      onClick={(e) => {
        if (isReordering) return; // Disable toggle in edit mode
        if ((e.target as HTMLElement).closest('.action-btn')) return;
        if ((e.target as HTMLElement).closest('.menu-container')) return;
        onToggle(task.id);
      }}
    >
      {/* Edit Mode Overlay Icon */}
      {isReordering && (
         <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
             <Move size={28} className="text-white opacity-80" />
         </div>
      )}

      {/* Order Badge */}
      <div className="absolute top-2 right-2 text-[9px] font-bold text-zinc-600 bg-zinc-900/50 px-1.5 py-0.5 rounded-full z-0 group-hover:opacity-0 transition-opacity">
        #{index + 1}
      </div>

      {/* Counter Big Number Display */}
      {isCounter && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <span className="text-6xl font-black text-white select-none">{task.count || 0}</span>
          </div>
      )}

      {/* Content */}
      <div className="mt-auto z-10 relative pointer-events-none">
         <div className="flex items-end justify-between gap-1.5">
            <h3 className={`font-bold text-xs sm:text-sm leading-tight line-clamp-3 ${isActiveSimple ? 'text-zinc-500 line-through decoration-2' : 'text-white'}`} style={{ textDecorationColor: isActiveSimple ? themeColor : undefined }}>
               {task.title}
            </h3>
            
            <div 
              className={`shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border transition-all 
                ${isActiveSimple ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900/50 border-zinc-700'}
              `}
              style={{ 
                  borderColor: (isActiveSimple || (isCounter && (task.count || 0) > 0)) ? themeColor : undefined, 
                  color: (isActiveSimple || (isCounter && (task.count || 0) > 0)) ? themeColor : '#71717a' 
              }}
            >
              {isCounter ? (
                  <span className="text-[10px] font-bold">{task.count || 0}</span>
              ) : (
                  isActiveSimple ? <Check size={12} strokeWidth={3} /> : <Play size={10} fill="currentColor" className="ml-0.5" />
              )}
            </div>
         </div>
         {task.description && (
            <div className="mt-1 flex items-center gap-1">
               <div className="h-1 w-1 rounded-full bg-zinc-600" />
               <span className="text-[8px] sm:text-[9px] text-zinc-500 font-medium truncate max-w-full">{t.viewDetails}</span>
            </div>
         )}
      </div>

      {/* Menu Button - Only show if not reordering */}
      {!isReordering && (
        <button 
          onClick={(e) => {
             e.stopPropagation();
             setShowMenu(!showMenu);
          }}
          className="action-btn absolute top-1 right-1 p-1.5 text-zinc-600 hover:text-white rounded-lg hover:bg-zinc-700/50 opacity-0 group-hover:opacity-100 transition-all z-20"
        >
          <MoreVertical size={14} />
        </button>
      )}

      {/* Menu Dropdown */}
      {showMenu && !isReordering && (
        <div className="menu-container absolute top-8 right-2 w-28 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
           <button 
             onClick={() => { setShowMenu(false); onViewInfo(task); }}
             className="w-full text-left px-3 py-2 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
           >
             <Info size={12} /> {t.viewDetails}
           </button>
           <button 
             onClick={() => { setShowMenu(false); onEdit(task); }}
             className="w-full text-left px-3 py-2 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
           >
             <span className="w-3 h-3 flex items-center justify-center border border-zinc-500 rounded-[2px] text-[8px]">E</span> {t.edit}
           </button>
           <div className="h-px bg-zinc-800 my-1" />
           <button 
             onClick={() => { setShowMenu(false); onDelete(task.id); }}
             className="w-full text-left px-3 py-2 text-[10px] font-medium text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2"
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