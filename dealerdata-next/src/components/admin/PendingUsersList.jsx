import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';

function parseIds(str) {
  return str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
}

export default function PendingUsersList({ selectedGroupId, selectedStoreId, allGroups, allStores }) {
  const [sending, setSending] = useState({});
  const qc = useQueryClient();

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers', selectedGroupId, selectedStoreId],
    queryFn: async () => {
      const all = await base44.entities.PendingUser.list('email', 500);
      
      // Filter by selection
      if (selectedGroupId) {
        return all.filter(u => parseIds(u.dealer_group_ids).some(gid => String(gid) === String(selectedGroupId)));
      }
      if (selectedStoreId) {
        return all.filter(u => parseIds(u.store_ids).some(sid => String(sid) === String(selectedStoreId)));
      }
      return all;
    },
  });

  const deletePending = async (id) => {
    try {
      await base44.entities.PendingUser.delete(id);
      qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      toast.success('Pending user removed');
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const sendInvite = async (pending) => {
    setSending(s => ({ ...s, [pending.id]: true }));
    try {
      await base44.users.inviteUser(pending.email, pending.role || 'user');
      
      // Mark as invited
      await base44.entities.PendingUser.update(pending.id, { invited: true });
      qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      toast.success(`Invite sent to ${pending.email}`);
    } catch (e) {
      toast.error(e.message || 'Failed to send invite');
    }
    setSending(s => ({ ...s, [pending.id]: false }));
  };

  const getGroupName = (groupId) => {
    const ids = parseIds(groupId);
    return ids.map(id => allGroups.find(g => String(g.id) === String(id))?.name || '').filter(Boolean).join(', ') || '—';
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700',
      manager: 'bg-blue-100 text-blue-700',
      user: 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  if (pendingUsers.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-3">No pending users yet. Add one above to get started.</div>
    );
  }

  return (
    <div className="space-y-2">
      {pendingUsers.map(u => (
        <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{u.full_name || u.email}</p>
            <p className="text-xs text-gray-500">{u.email}</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge className={`text-xs font-semibold ${getRoleColor(u.role)}`}>{u.role}</Badge>
            <span className="text-xs text-gray-500">{getGroupName(u.dealer_group_ids)}</span>
            {u.invited && <Badge variant="outline" className="text-xs">Invited</Badge>}
            {u.matched && <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Matched</Badge>}
          </div>

          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-gray-400 hover:text-blue-600"
              onClick={() => sendInvite(u)}
              disabled={u.invited || sending[u.id]}
              title={u.invited ? 'Already invited' : 'Send invite'}
            >
              <Mail size={13} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-gray-400 hover:text-red-600"
              onClick={() => deletePending(u.id)}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}