import React from 'react';
import useSWR, { mutate } from 'swr';
import { X, Mail, Check, Ban } from 'lucide-react';
import { Group } from '../types';

interface InvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const InvitesModal: React.FC<InvitesModalProps> = ({ isOpen, onClose, themeColor }) => {
  const { data: invites, mutate: mutateInvites } = useSWR<Group[]>(isOpen ? '/api/user/invites' : null, fetcher);

  const handleAction = async (groupId: string, action: 'accept' | 'decline') => {
      try {
          await fetch(`/api/groups/${groupId}/${action}`, { method: 'POST' });
          mutateInvites(); // Refresh invites list
          mutate('/api/groups'); // Refresh sidebar groups
      } catch (e) {
          console.error(e);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail size={20} style={{ color: themeColor }} />
            Pending Invites
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {(!invites || invites.length === 0) && (
              <div className="text-center py-8 text-zinc-500">
                  <Mail size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No pending invites.</p>
              </div>
          )}
          
          {invites?.map(group => (
            <div key={group.id} className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 flex flex-col gap-3">
               <div>
                  <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Invited to join</div>
                  <h3 className="text-lg font-bold text-white">{group.name}</h3>
               </div>
               <div className="flex gap-2">
                   <button 
                      onClick={() => handleAction(group.id, 'accept')}
                      className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 font-bold text-sm flex items-center justify-center gap-2"
                   >
                      <Check size={14} /> Accept
                   </button>
                   <button 
                      onClick={() => handleAction(group.id, 'decline')}
                      className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold text-sm flex items-center justify-center gap-2"
                   >
                      <Ban size={14} /> Decline
                   </button>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InvitesModal;