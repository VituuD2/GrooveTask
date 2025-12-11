import React, { useState } from 'react';
import { Users, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
  themeColor: string;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose, onGroupCreated, themeColor }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      onGroupCreated();
      onClose();
      setName('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} style={{ color: themeColor }} />
            New Crew
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Crew Name</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900"
              style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
              placeholder="Neon Runners"
              autoFocus
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center"
            style={{ backgroundColor: themeColor }}
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Launch'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;