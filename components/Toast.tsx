import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Wait for animation
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle size={18} className="text-green-400" />;
      case 'error': return <AlertCircle size={18} className="text-red-400" />;
      default: return <Info size={18} className="text-blue-400" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success': return 'border-green-500/20 bg-zinc-900/95';
      case 'error': return 'border-red-500/20 bg-zinc-900/95';
      default: return 'border-blue-500/20 bg-zinc-900/95';
    }
  };

  return (
    <div 
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md min-w-[300px] max-w-sm
        transition-all duration-300 transform
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0 animate-in slide-in-from-right-full'}
        ${getStyles()}
      `}
    >
      <div className="shrink-0">
        {getIcon()}
      </div>
      <p className="flex-1 text-sm font-medium text-zinc-100">{toast.message}</p>
      <button 
        onClick={handleClose} 
        className="shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors text-zinc-500 hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;