import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/SectionCard';
import { UserPlus, Trash2, Shield, User, RefreshCw, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

function parseIds(str) {
  return str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function addId(existing, newId) {
  const ids = parseIds(existing);
  if (ids.includes(newId)) return existing;
  return [...ids, newId].join(',');
}

function removeId(existing, id) {
  return parseIds(existing).filter(i => i !== id).join(',');
}

function UserRow({ user, targetType, targetId, targetLabel, onRemove }) {
  const isAdmin = user.role === 'admin';
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-100 bg-white">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          {isAdmin ? <Shield size={14} className="text-blue-600" /> : <User size={14} className="text-gray-500" />}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{user.full_name || '—'}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Mail size={10} /> {user.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-xs">
          {isAdmin ? 'Admin' : 'User'}
        </Badge>
        {!isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-red-500"
            onClick={() => onRemove(user)}
          >
            <Trash2 size={13} />
          </Button>
        )}
        {isAdmin && (
          <span className="text-xs text-gray-400 italic pr-1">full access</span>
        )}
      </div>
    </div>
  );
}

export default function UserAccess({ targetType, targetId, targetLabel, groups, stores }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const qc = useQueryClient();

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });

  // Admins always have access; regular users are filtered by their IDs
  const admins = allUsers.filter(u => u.role === 'admin');

  const usersWithAccess = allUsers.filter(u => {
    if (u.role === 'admin') return false;
    if (targetType === 'group') {
      return parseIds(u.dealer_group_ids).includes(targetId);
    } else {
      return parseIds(u.store_ids).includes(targetId);
    }
  });

  const displayUsers = [...admins, ...usersWithAccess];

  // Users not yet assigned to this target (for invite/assign)
  const unassignedUsers = allUsers.filter(u => {
    if (u.role === 'admin') return false;
    if (targetType === 'group') {
      return !parseIds(u.dealer_group_ids).includes(targetId);
    } else {
      return !parseIds(u.store_ids).includes(targetId);
    }
  });

  const removeUser = async (user) => {
    const update = targetType === 'group'
      ? { dealer_group_ids: removeId(user.dealer_group_ids, targetId) }
      : { store_ids: removeId(user.store_ids, targetId) };
    console.log('[UserAccess] removeUser:', { targetId, update });
    await base44.auth.updateMe ? null : null; // not used
    await base44.entities.User.update(user.id, update);
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['userAccessRecord'] });
    toast.success('User removed from ' + targetLabel);
  };

  const inviteAndAssign = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      // Check if user already exists
      const existing = allUsers.find(u => u.email.toLowerCase() === inviteEmail.trim().toLowerCase());
      if (existing) {
        // Just assign access
        const update = targetType === 'group'
          ? { dealer_group_ids: addId(existing.dealer_group_ids, targetId) }
          : { store_ids: addId(existing.store_ids, targetId) };
        console.log('[UserAccess] inviteAndAssign - payload:', { 
          userId: existing.id, 
          targetType, 
          targetId, 
          existing_dealer_group_ids: existing.dealer_group_ids,
          update 
        });
        await base44.entities.User.update(existing.id, update);
        const refreshed = await base44.entities.User.filter({ email: existing.email }, null, 1);
        console.log('[UserAccess] inviteAndAssign - after save:', refreshed?.[0]);
        qc.invalidateQueries({ queryKey: ['users'] });
        qc.invalidateQueries({ queryKey: ['userAccessRecord'] });
        toast.success(`Access granted to ${existing.full_name || existing.email}`);
      } else {
        // Invite new user
        await base44.users.inviteUser(inviteEmail.trim(), 'user');
        toast.success(`Invite sent to ${inviteEmail.trim()}. After they register, assign them access from this panel.`);
      }
      setInviteEmail('');
    } catch (e) {
      console.error('[UserAccess] inviteAndAssign error:', e);
      toast.error(e.message || 'Failed');
    }
    setInviting(false);
  };

  const assignExisting = async (user) => {
    const update = targetType === 'group'
      ? { dealer_group_ids: addId(user.dealer_group_ids, targetId) }
      : { store_ids: addId(user.store_ids, targetId) };
    console.log('[UserAccess] assignExisting - payload:', {
      userId: user.id,
      targetType,
      targetId,
      existing_dealer_group_ids: user.dealer_group_ids,
      update,
    });
    await base44.entities.User.update(user.id, update);
    const refreshed = await base44.entities.User.filter({ email: user.email }, null, 1);
    console.log('[UserAccess] assignExisting - after save:', refreshed?.[0]);
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['userAccessRecord'] });
    toast.success(`${user.full_name || user.email} given access to ${targetLabel}`);
  };

  if (!targetId) {
    return (
      <SectionCard title="User Access">
        <p className="text-gray-400 text-sm">Select a group or store from the dropdown above to manage its users.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={`Users with access to ${targetLabel}`}>
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Loading users…
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current users */}
          <div className="space-y-2">
            {displayUsers.length === 0 && (
              <p className="text-gray-400 text-sm py-2">No users have access yet.</p>
            )}
            {displayUsers.map(u => (
              <UserRow
                key={u.id}
                user={u}
                targetType={targetType}
                targetId={targetId}
                targetLabel={targetLabel}
                onRemove={removeUser}
              />
            ))}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            {/* Assign existing users */}
            {unassignedUsers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assign Existing User</p>
                <div className="flex flex-wrap gap-2">
                  {unassignedUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => assignExisting(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <UserPlus size={11} /> {u.full_name || u.email}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Invite new user */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Invite New User</p>
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && inviteAndAssign()}
                  className="flex-1 text-sm h-9"
                />
                <Button
                  size="sm"
                  className="bg-slate-900 hover:bg-slate-800 gap-1.5"
                  onClick={inviteAndAssign}
                  disabled={inviting || !inviteEmail.trim()}
                >
                  <UserPlus size={13} />
                  {inviting ? 'Sending…' : 'Invite'}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">If the user already exists in the app, they'll get access immediately. Otherwise an invite email will be sent.</p>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}