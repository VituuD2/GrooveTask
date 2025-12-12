import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { X, Crown, User, ShieldCheck, LogOut, Trash2, Ban } from 'lucide-react';
import { GroupMember, UserProfile } from '../types';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  themeColor: string;
  currentUser: UserProfile | null;
  onGroupAction: () => void;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const GroupInfoModal: React.FC<GroupInfoModalProps> = ({ isOpen, onClose, groupId, themeColor, currentUser, onGroupAction }) => {
  const { data: members, error, mutate: mutateMembers } = useSWR<GroupMember[]>(
    isOpen ? `/api/groups/${groupId}/members` : null, 
    fetcher
  );
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const currentMember = members?.find(m => m.username === currentUser.username);
  const isOwner = currentMember?.role === 'owner';

  const handleKick = async (userId: string) => {
      if(!confirm("Are you sure you want to kick this member?")) return;
      setLoadingAction(`kick-${userId}`);
      try {
          await fetch(`/api/groups/${groupId}/kick`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
          });
          mutateMembers();
      } catch(e) {
          console.error(e);
      } finally {
          setLoadingAction(null);
      }
  };

  const handleLeave = async () => {
      if(!confirm("Are you sure you want to leave this group?")) return;
      setLoadingAction('leave');
      try {
          await fetch(`/api/groups/${groupId}/leave`, { method: 'POST' });
          onGroupAction();
      } catch(e) {
          console.error(e);
      } finally {
          setLoadingAction(null);
      }
  };

  const handleDeleteGroup = async () => {
      if(!confirm("WARNING: This will delete the group and all its data for EVERYONE. This cannot be undone.")) return;
      setLoadingAction('delete');
      try {
          await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
          onGroupAction();
      } catch(e) {
          console.error(e);
      } finally {
          setLoadingAction(null);
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 pb-2 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: themeColor }} />
            Crew Members
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-2 shrink-0 text-xs text-zinc-500 border-b border-zinc-800/50 mb-2">
            {members?.length || 0} Members • {isOwner ? 'You are the Admin' : 'Member View'}
        </div>

        <div className="space-y-2 overflow-y-auto px-6 pb-6 flex-1">
          {!members && !error && <div className="text-center text-zinc-500 py-4">Loading members...</div>}
          
          {members?.map(member => {
            const memberIsOwner = member.role === 'owner';
            return (
                <div key={member.id} className={`flex items-center justify-between p-3 rounded-xl border ${memberIsOwner ? 'bg-zinc-800/60 border-yellow-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
                   <div className="flex items-center gap-3">
                      <div 
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${memberIsOwner ? 'bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50' : 'bg-zinc-800 text-zinc-400'}`}
                      >
                          {memberIsOwner ? <Crown size={14} /> : member.username[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                          <span className={`text-sm font-bold ${memberIsOwner ? 'text-yellow-500' : 'text-zinc-200'}`}>
                            {member.username}
                          </span>
                          {memberIsOwner && <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Admin</span>}
                      </div>
                   </div>
                   
                   {/* Admin Actions */}
                   {isOwner && !memberIsOwner && (
                       <button 
                         onClick={() => handleKick(member.id)}
                         disabled={!!loadingAction}
                         className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                         title="Kick User"
                       >
                           {loadingAction === `kick-${member.id}` ? <span className="animate-spin text-xs">...</span> : <Ban size={16} />}
                       </button>
                   )}
                </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
             {isOwner ? (
                 <button 
                    onClick={handleDeleteGroup}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 font-bold transition-all"
                 >
                    {loadingAction === 'delete' ? 'Deleting...' : <><Trash2 size={16} /> Delete Crew</>}
                 </button>
             ) : (
                 <button 
                    onClick={handleLeave}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-white font-bold transition-all"
                 >
                    {loadingAction === 'leave' ? 'Leaving...' : <><LogOut size={16} /> Leave Crew</>}
                 </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;