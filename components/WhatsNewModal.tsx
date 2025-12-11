import React from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { APP_VERSION } from '../constants';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose, themeColor }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-sm shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Background Decorative Gradient */}
        <div 
            className="absolute top-0 inset-x-0 h-32 opacity-20 pointer-events-none"
            style={{ 
                background: `radial-gradient(circle at top, ${themeColor}, transparent 70%)` 
            }}
        />

        <div className="relative p-6 pt-8 flex flex-col items-center text-center">
            
            <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-black/50 rotate-3 transform transition-transform hover:rotate-6"
                style={{ backgroundColor: themeColor }}
            >
                <Sparkles size={32} className="text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">
                {t.whatsNew}
            </h2>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-400 mb-6">
                {t.version} {APP_VERSION}
            </div>

            <div className="w-full space-y-3 mb-8 text-left">
                {t.releaseNotes.map((note, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800/50">
                        <div className="shrink-0 mt-0.5 text-green-400">
                             <Check size={16} />
                        </div>
                        <p className="text-sm text-zinc-300 leading-snug">
                            {note}
                        </p>
                    </div>
                ))}
            </div>

            <button 
                onClick={onClose}
                className="w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: themeColor, boxShadow: `0 4px 20px -5px ${themeColor}80` }}
            >
                {t.gotIt}
            </button>
        </div>
        
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
        >
            <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default WhatsNewModal;