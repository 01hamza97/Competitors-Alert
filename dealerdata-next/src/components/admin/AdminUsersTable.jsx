import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Trash2, Edit2, Mail, Loader2, CheckCircle, GitMerge } from 'lucide-react';
import { toast } from 'sonner';

function parseIds(str) {
  return str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
}

export default function AdminUsersTable({ allGroups, allStores, currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterStore, setFilterStore] = useState('all');
  const [sortKey, setSortKey] = useState('full_name');
  const [sortDir, setSortDir] = useState('asc');
  const [sendingInvite, setSendingInvite] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    email: '',
    full_name: '',
    role: 'user',
    dealer_group_ids: '',
    store_ids: '',
    daily_summary_enabled: false,
    appointments_enabled: false,
    competitor_report_enabled: false,
  });
  const [addingUser, setAddingUser] = useState(false);
  const qc = useQueryClient();

  const isSuperAdmin = currentUser?.role === 'admin';

  const { data: registeredUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list('email', 500),
  });

  // Merge registered and pending users
  const allUsers = useMemo(() => {
    const registered = registeredUsers.map(u => ({ ...u, isPending: false, status: 'Active' }));
    const pending = pendingUsers.map(u => ({ ...u, isPending: true, status: u.invited ? 'Invited' : 'Pending' }));
    return [...registered, ...pending];
  }, [registeredUsers, pendingUsers]);

  // Apply filters and search
  const filtered = useMemo(() => {
    let result = [...allUsers];

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(u => (u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)));
    }

    // Role filter
    if (filterRole !== 'all') {
      result = result.filter(u => u.role === filterRole);
    }

    // Group filter
    if (filterGroup !== 'all') {
      result = result.filter(u => parseIds(u.dealer_group_ids).includes(filterGroup));
    }

    // Store filter - show users assigned to store OR to a group containing this store
    if (filterStore !== 'all') {
      result = result.filter(u => {
        const storeIds = parseIds(u.store_ids);
        const groupIds = parseIds(u.dealer_group_ids);
        // Include if directly assigned to store
        const inStore = storeIds.includes(filterStore);
        // OR if assigned to a group containing this store
        const inGroup = groupIds.some(gid => {
          const storesInGroup = allStores.filter(s => String(s.group_id) === String(gid));
          return storesInGroup.some(s => String(s.id) === String(filterStore));
        });
        return inStore || inGroup;
      });
    }

    return result;
  }, [allUsers, searchTerm, filterRole, filterGroup, filterStore, allStores]);

  // Sort
  const sorted = useMemo(() => {
    const result = [...filtered];
    result.sort((a, b) => {
      let aVal = a[sortKey] || '';
      let bVal = b[sortKey] || '';
      if (sortKey === 'full_name' || sortKey === 'email') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    return result;
  }, [filtered, sortKey, sortDir]);

  const toggleSubscription = async (user, setting) => {
    if (user.isPending) {
      // Update pending user
      const newVal = !user[setting];
      await base44.entities.PendingUser.update(user.id, { [setting]: newVal });
    } else {
      // Update registered user
      const newVal = !user[setting];
      await base44.entities.User.update(user.id, { [setting]: newVal });
    }
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['pendingUsers'] });
    toast.success('Updated');
  };

  const deleteUser = async (user) => {
    if (!confirm(`Remove ${user.full_name || user.email}?`)) return;
    try {
      if (user.isPending) {
        await base44.entities.PendingUser.delete(user.id);
        qc.invalidateQueries({ queryKey: ['pendingUsers'] });
        toast.success('Removed');
      } else {
        toast.error('Cannot delete registered users. Revoke access from Settings instead.');
      }
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  // Dismiss a pending user that has already been matched to a registered account
  const dismissMatched = async (pendingUser) => {
    if (!confirm(`Delete the pending record for ${pendingUser.full_name || pendingUser.email}? Their registered account will not be affected.`)) return;
    try {
      await base44.entities.PendingUser.delete(pendingUser.id);
      qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      toast.success('Duplicate pending record removed');
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'user',
      dealer_group_ids: user.dealer_group_ids || '',
      store_ids: user.store_ids || '',
    });
  };

  const saveEdit = async () => {
    const user = editingUser;
    if (!editForm.email.trim()) { toast.error('Email is required'); return; }
    setSavingEdit(true);
    try {
      if (user.isPending) {
        await base44.entities.PendingUser.update(user.id, editForm);
      } else {
        await base44.entities.User.update(user.id, {
          full_name: editForm.full_name,
          role: editForm.role,
          dealer_group_ids: editForm.dealer_group_ids,
          store_ids: editForm.store_ids,
        });
      }
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      setEditingUser(null);
      toast.success('Updated');
    } catch (e) {
      toast.error('Failed to update');
    }
    setSavingEdit(false);
  };

  // Toggle a group ID in the edit form
  const toggleGroupId = (gid) => {
    const ids = parseIds(editForm.dealer_group_ids);
    const next = ids.includes(gid) ? ids.filter(x => x !== gid) : [...ids, gid];
    setEditForm(f => ({ ...f, dealer_group_ids: next.join(',') }));
  };

  // Toggle a store ID in the edit form
  const toggleStoreId = (sid) => {
    const ids = parseIds(editForm.store_ids);
    const next = ids.includes(sid) ? ids.filter(x => x !== sid) : [...ids, sid];
    setEditForm(f => ({ ...f, store_ids: next.join(',') }));
  };

  const sendInvite = async (user) => {
    if (!user.isPending) return;
    setSendingInvite(s => ({ ...s, [user.id]: true }));
    let success = false;
    let errorMsg = '';
    try {
      const res = await base44.functions.invoke('inviteUser', { email: user.email, role: user.role, full_name: user.full_name });
      if (res.data?.error) throw new Error(res.data.error);
      await base44.entities.PendingUser.update(user.id, { invited: true });
      qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      success = true;
    } catch (e) {
      errorMsg = e.message || 'Failed to send invite';
    }
    setSendingInvite(s => ({ ...s, [user.id]: false }));
    if (success) {
      toast.success(`✓ Invite sent to ${user.email}`);
    } else {
      const friendlyMsg = errorMsg.includes('outside the app')
        ? `${user.email} must first be invited to the app via the Base44 dashboard (Settings → Members → Invite) before they can be sent a role invite here.`
        : errorMsg;
      toast.error(friendlyMsg, { duration: 8000 });
      alert(friendlyMsg);
    }
  };

  const getGroupNames = (groupIds) => {
    const ids = parseIds(groupIds);
    return ids.map(id => allGroups.find(g => String(g.id) === String(id))?.name || id).join(', ') || '—';
  };

  const getStoreNames = (storeIds, groupIds) => {
    const storeSet = new Set();
    
    // Add directly assigned stores
    const storeIdsList = parseIds(storeIds);
    storeIdsList.forEach(id => {
      const store = allStores.find(s => String(s.id) === String(id));
      if (store) storeSet.add(store.name);
    });
    
    // Add stores from assigned groups
    const groupIdsList = parseIds(groupIds);
    groupIdsList.forEach(gid => {
      const storesInGroup = allStores.filter(s => String(s.group_id) === String(gid));
      storesInGroup.forEach(s => storeSet.add(s.name));
    });
    
    return Array.from(storeSet).sort();
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700',
      manager: 'bg-blue-100 text-blue-700',
      user: 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ active, dir }) => {
    if (!active) return null;
    return <span className="ml-1 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">
        Only super admins can manage users. This page is for administrators only.
      </div>
    );
  }

  const addNewUser = async () => {
    if (!addForm.email.trim()) {
      toast.error('Email is required');
      return;
    }
    setAddingUser(true);
    try {
      await base44.entities.PendingUser.create(addForm);
      qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      setShowAddForm(false);
      setAddForm({
        email: '',
        full_name: '',
        role: 'user',
        dealer_group_ids: '',
        store_ids: '',
        daily_summary_enabled: false,
        appointments_enabled: false,
        competitor_report_enabled: false,
      });
      toast.success('User pre-added');
    } catch (e) {
      toast.error(e.message || 'Failed to add user');
    }
    setAddingUser(false);
  };

  return (
    <div className="space-y-4">
      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Pre-Add User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              type="email"
              placeholder="Email *"
              value={addForm.email}
              onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
              className="text-sm h-8"
            />
            <Input
              placeholder="Full Name"
              value={addForm.full_name}
              onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
              className="text-sm h-8"
            />
            <select
              value={addForm.role}
              onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
              className="text-sm border border-gray-200 rounded-md px-2 h-8 bg-white"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Dealer Groups */}
          {allGroups.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Dealer Groups</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {allGroups.map(g => (
                  <label key={g.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={parseIds(addForm.dealer_group_ids).includes(String(g.id))}
                      onCheckedChange={() => {
                        const ids = parseIds(addForm.dealer_group_ids);
                        const next = ids.includes(String(g.id)) ? ids.filter(x => x !== String(g.id)) : [...ids, String(g.id)];
                        setAddForm(f => ({ ...f, dealer_group_ids: next.join(',') }));
                      }}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Individual Stores */}
          {allStores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Individual Stores <span className="font-normal text-gray-400">(optional)</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {allStores.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={parseIds(addForm.store_ids).includes(String(s.id))}
                      onCheckedChange={() => {
                        const ids = parseIds(addForm.store_ids);
                        const next = ids.includes(String(s.id)) ? ids.filter(x => x !== String(s.id)) : [...ids, String(s.id)];
                        setAddForm(f => ({ ...f, store_ids: next.join(',') }));
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 text-xs">
            <label className="flex items-center gap-1">
              <Checkbox
                checked={addForm.daily_summary_enabled}
                onCheckedChange={c => setAddForm(f => ({ ...f, daily_summary_enabled: c }))}
              />
              Daily Summary
            </label>
            <label className="flex items-center gap-1">
              <Checkbox
                checked={addForm.appointments_enabled}
                onCheckedChange={c => setAddForm(f => ({ ...f, appointments_enabled: c }))}
              />
              Appointments
            </label>
            <label className="flex items-center gap-1">
              <Checkbox
                checked={addForm.competitor_report_enabled}
                onCheckedChange={c => setAddForm(f => ({ ...f, competitor_report_enabled: c }))}
              />
              Competitor Report
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 h-8" onClick={addNewUser} disabled={addingUser}>
              Add User
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 flex-1">
            <Search size={16} className="text-gray-400" />
            <Input
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 border-0 px-0 focus-visible:ring-0"
            />
          </div>
          {!showAddForm && (
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 h-9 px-3" onClick={() => setShowAddForm(true)}>
              + Add User
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="user">User</option>
          </select>

          <select
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">All Groups</option>
            {allGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select
            value={filterStore}
            onChange={e => setFilterStore(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">All Stores</option>
            {allStores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 cursor-pointer" onClick={() => handleSort('full_name')}>
                    Name <SortIcon active={sortKey === 'full_name'} dir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 cursor-pointer" onClick={() => handleSort('email')}>
                    Email <SortIcon active={sortKey === 'email'} dir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Dealer Group</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Stores</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Daily</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Appts</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Comp</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 w-12">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((user, i) => (
                  <tr key={user.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{user.full_name || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 text-xs">{user.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs font-semibold ${getRoleColor(user.role)}`}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{getGroupNames(user.dealer_group_ids)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {getStoreNames(user.store_ids, user.dealer_group_ids).length > 0
                        ? getStoreNames(user.store_ids, user.dealer_group_ids).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={!!user.daily_summary_enabled} onCheckedChange={() => toggleSubscription(user, 'daily_summary_enabled')} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={!!user.appointments_enabled} onCheckedChange={() => toggleSubscription(user, 'appointments_enabled')} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={!!user.competitor_report_enabled} onCheckedChange={() => toggleSubscription(user, 'competitor_report_enabled')} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={`h-2.5 w-2.5 rounded-full mx-auto ${user.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} title={user.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {user.isPending && user.matched && (
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-amber-500 hover:text-amber-700"
                            onClick={() => dismissMatched(user)}
                            title="Matched to registered account — click to remove this duplicate pending record">
                            <GitMerge size={13} />
                          </Button>
                        )}
                        {user.isPending && !user.matched && (
                          <Button size="icon" variant="ghost"
                            className={`h-7 w-7 ${user.invited ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-blue-600'}`}
                            onClick={() => sendInvite(user)} disabled={sendingInvite[user.id]}
                            title={user.invited ? 'Re-send invite' : 'Send invite'}>
                            {sendingInvite[user.id]
                              ? <Loader2 size={13} className="animate-spin" />
                              : user.invited
                                ? <CheckCircle size={13} />
                                : <Mail size={13} />}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-slate-600"
                          onClick={() => startEdit(user)} title="Edit">
                          <Edit2 size={13} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600"
                          onClick={() => deleteUser(user)} title="Remove">
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {sorted.length} user{sorted.length !== 1 ? 's' : ''} shown
      </p>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User — {editingUser?.full_name || editingUser?.email}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Full Name</label>
                <Input value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
                <Input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-sm" disabled={!editingUser?.isPending} />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Role</label>
              <select value={editForm.role || 'user'} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                className="text-sm border border-gray-200 rounded-md px-2 h-8 bg-white w-full">
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Dealer Groups */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Dealer Groups</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2">
                {allGroups.map(g => (
                  <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={parseIds(editForm.dealer_group_ids).includes(String(g.id))}
                      onCheckedChange={() => toggleGroupId(String(g.id))}
                    />
                    <span className="text-gray-700">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Individual Stores */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Individual Stores <span className="font-normal text-gray-400">(optional — overrides group if needed)</span>
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2">
                {allStores.map(s => {
                  const groupNames = allGroups.filter(g => String(g.id) === String(s.group_id)).map(g => g.name);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <Checkbox
                        checked={parseIds(editForm.store_ids).includes(String(s.id))}
                        onCheckedChange={() => toggleStoreId(String(s.id))}
                      />
                      <span className="text-gray-700">{s.name}</span>
                      {groupNames.length > 0 && <span className="text-gray-400 text-xs">({groupNames[0]})</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}