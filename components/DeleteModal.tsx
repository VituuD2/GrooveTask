import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskTitle?: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, taskTitle }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 transform scale-100 transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-full ring-1 ring-red-500/20">
            <AlertTriangle size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white">{t.deleteTrackTitle}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {t.deleteConfirm} <span className="text-white font-medium">{taskTitle ? `"${taskTitle}"` : ''}</span>?
              <br />
              <span className="text-red-400/80 text-xs">{t.actionUndone}</span>
            </p>
          </div>
          <div className="flex gap-3 w-full mt-4">
            <button 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              {t.cancel}
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20 border border-red-500/50"
            >
              {t.delete}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;