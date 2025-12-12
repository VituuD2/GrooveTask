import React from 'react';
import useSWR from 'swr';
import { X, Crown, User, ShieldCheck } from 'lucide-react';
import { GroupMember } from '../types';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  themeColor: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const GroupInfoModal: React.FC<GroupInfoModalProps> = ({ isOpen, onClose, groupId, themeColor }) => {
  const { data: members, error } = useSWR<GroupMember[]>(
    isOpen ? `/api/groups/${groupId}/members` : null, 
    fetcher
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: themeColor }} />
            Crew Members
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {!members && !error && <div className="text-center text-zinc-500 py-4">Loading members...</div>}
          
          {members?.map(member => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                      {member.username[0].toUpperCase()}
                  </div>
                  <span className={`text-sm font-medium ${member.role === 'owner' ? 'text-white' : 'text-zinc-300'}`}>
                    {member.username}
                  </span>
               </div>
               {member.role === 'owner' && (
                  <div className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 text-[10px] font-bold uppercase flex items-center gap-1">
                      <Crown size={10} /> Owner
                  </div>
               )}
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-zinc-800 text-center text-xs text-zinc-500">
             {members?.length || 0} Members in this crew
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;