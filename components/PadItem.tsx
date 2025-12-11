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
        border-2 select-none touch-pan-y
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
      <div className="absolute top-1/2 left-4 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity">
         <GripVertical size={20} className="text-zinc-400" />
      </div>

      {/* Active Indicator Light */}
      <div 
        className={`absolute top-4 left-4 w-2 h-2 rounded-full transition-colors duration-300 ${task.isCompleted ? 'animate-pulse' : 'bg-zinc-700'}`}
        style={{ backgroundColor: task.isCompleted ? themeColor : undefined }}
      />

      {/* Actions Top Right */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        {/* Info Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onViewInfo(task);
          }}
          className="action-btn p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
          title={t.viewDetails}
        >
          <Info size={16} />
        </button>
        
        {/* Delete Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation(); 
            onDelete(task.id);
          }}
          className="action-btn p-1.5 text-zinc-400 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors"
          title={t.delete}
        >
          <X size={16} />
        </button>

        {/* Menu Button */}
        <div className="relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="action-btn p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          
          {showMenu && (
            <div 
              className="menu-container absolute right-0 mt-2 w-32 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="action-btn w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={(e) => { 
                  e.stopPropagation();
                  setShowMenu(false); 
                  onEdit(task); 
                }}
              >
                {t.edit}
              </button>
            </div>
          )}
        </div>
      </div>

      {showMenu && (
        <div 
          className="fixed inset-0 z-0 cursor-default" 
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(false);
          }} 
        />
      )}

      {/* Center Content */}
      <div className="flex-1 flex items-center justify-center text-center mt-4 pointer-events-none">
        {task.isCompleted ? (
           <Check size={48} style={{ color: themeColor }} className="opacity-50" />
        ) : (
           <Play size={32} className="text-zinc-600 opacity-20 group-hover:opacity-40 transition-opacity" />
        )}
      </div>

      {/* Bottom Text */}
      <div className="mt-2 pointer-events-none">
        <h3 
          className={`font-semibold text-lg leading-tight line-clamp-2 select-none transition-colors duration-300 ${task.isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}
        >
          {task.title}
        </h3>
      </div>
    </div>
  );
};

export default PadItem;