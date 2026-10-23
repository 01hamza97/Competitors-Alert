'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users,
  ShieldCheck,
  Plus,
  Search,
  Check,
  Trash2,
  Edit2,
  Lock,
  Mail,
  CheckCircle,
  AlertCircle,
  KeyRound,
  LayoutDashboard,
  Calendar,
  Activity,
  TrendingUp,
  ClipboardList,
  BarChart2,
  CreditCard,
  Building2,
  Sliders,
  ChevronRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// Full Module Accessibility Definitions
export const APP_MODULES = [
  {
    id: 'lead_performance',
    name: 'Lead Performance',
    icon: LayoutDashboard,
    description: 'Lead volume, source channel KPIs, closing rates, and MTD trends.',
    color: 'text-blue-500',
  },
  {
    id: 'appointments',
    name: 'Showroom Appointments',
    icon: Calendar,
    description: 'Confirmed showroom appointments, show rates, and calendar logs.',
    color: 'text-indigo-500',
  },
  {
    id: 'salesperson_activity',
    name: 'Salesperson Activity',
    icon: Activity,
    description: 'Outbound calls, text messages, emails sent, and units sold activity.',
    color: 'text-emerald-500',
  },
  {
    id: 'competitor_analysis',
    name: 'Competitive Market Intel',
    icon: TrendingUp,
    description: 'Scraped competitor lot pricing, model averages, and price drops.',
    color: 'text-amber-500',
  },
  {
    id: 'specials_entry',
    name: 'Specials Entry & Review',
    icon: ClipboardList,
    description: 'Vehicle and service specials staging, extraction, and website publishing.',
    color: 'text-purple-500',
  },
  {
    id: 'vendor_performance',
    name: 'Vendor Performance & ROI',
    icon: BarChart2,
    description: 'First-party vs Third-party vendor performance and conversion ratios.',
    color: 'text-cyan-500',
  },
  {
    id: 'team_management',
    name: 'Team & RBAC Admin',
    icon: Users,
    description: 'Add staff accounts, assign rooftop stores, and configure RBAC roles.',
    color: 'text-rose-500',
  },
  {
    id: 'billing',
    name: 'Subscription & Billing',
    icon: CreditCard,
    description: 'Manage SaaS subscription tier, plan quotas, and payment methods.',
    color: 'text-violet-500',
  },
  {
    id: 'client_admin',
    name: 'Client Admin (Stores & Scrapers)',
    icon: Building2,
    description: 'Group configurations, store rooftops, and scraper schedule rules.',
    color: 'text-slate-600',
  },
];

function parseIds(str) {
  return str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function parsePermissions(perms) {
  if (Array.isArray(perms)) return perms;
  if (typeof perms === 'string') {
    try {
      const parsed = JSON.parse(perms);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return perms.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export default function TeamAndRbacSettings({ currentUser }) {
  const [activeSection, setActiveSection] = useState('users'); // 'users' | 'roles'
  const qc = useQueryClient();

  // Load Groups & Stores
  const { data: allGroups = [] } = useQuery({
    queryKey: ['dealerGroups'],
    queryFn: () => base44.entities.DealerGroup.list('name', 200),
  });

  const { data: allStores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => base44.entities.Store.list('name', 200),
  });

  // Load Roles
  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list('name', 100),
  });

  // Load Registered & Pending Users
  const { data: registeredUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list('email', 500),
  });

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStore, setFilterStore] = useState('all');

  // Add User State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    email: '',
    full_name: '',
    role: 'user',
    dealer_group_ids: '',
    store_ids: '',
    daily_summary_enabled: true,
    appointments_enabled: true,
    competitor_report_enabled: false,
  });

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Role Modal State: handles both Create and Update (Edit)
  const [roleModalMode, setRoleModalMode] = useState(null); // 'create' | 'edit' | null
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    slug: '',
    description: '',
    modules: ['lead_performance', 'appointments'],
  });
  const [savingRole, setSavingRole] = useState(false);

  // Combine registered and pending users
  const allUsers = useMemo(() => {
    const registered = registeredUsers.map(u => ({ ...u, isPending: false, status: 'Active' }));
    const pending = pendingUsers.map(u => ({ ...u, isPending: true, status: u.invited ? 'Invited' : 'Pending' }));
    return [...registered, ...pending];
  }, [registeredUsers, pendingUsers]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let result = [...allUsers];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(u =>
        (u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
      );
    }
    if (filterRole !== 'all') {
      result = result.filter(u => u.role === filterRole);
    }
    if (filterStore !== 'all') {
      result = result.filter(u => {
        const storeIds = parseIds(u.store_ids);
        return storeIds.includes(filterStore);
      });
    }
    return result;
  }, [allUsers, searchTerm, filterRole, filterStore]);

  // Role color lookup
  const getRoleBadgeStyle = (roleSlug) => {
    switch (roleSlug) {
      case 'admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'manager':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'sales_manager':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'bdc_director':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'analyst':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'user':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getRoleDisplayName = (roleSlug) => {
    const found = roles.find(r => r.slug === roleSlug);
    if (found) return found.name;
    return roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1).replace(/_/g, ' ');
  };

  // Checkbox toggle with instant MySQL persistence
  const toggleNotification = async (user, settingKey) => {
    const newVal = !user[settingKey];
    try {
      if (user.isPending) {
        await base44.entities.PendingUser.update(user.id, { [settingKey]: newVal });
        qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      } else {
        await base44.entities.User.update(user.id, { [settingKey]: newVal });
        qc.invalidateQueries({ queryKey: ['users'] });
      }
      toast.success(`Updated ${settingKey.replace(/_/g, ' ')} for ${user.full_name || user.email}`);
    } catch (err) {
      toast.error('Failed to update subscription preference');
    }
  };

  // Add User
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!addUserForm.email.trim()) {
      toast.error('Email is required');
      return;
    }
    setAddingUser(true);
    try {
      await base44.entities.PendingUser.create(addUserForm);
      qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      toast.success(`Invited ${addUserForm.email} successfully!`);
      setShowAddUserModal(false);
      setAddUserForm({
        email: '',
        full_name: '',
        role: 'user',
        dealer_group_ids: '',
        store_ids: '',
        daily_summary_enabled: true,
        appointments_enabled: true,
        competitor_report_enabled: false,
      });
    } catch (err) {
      toast.error(err.message || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  // Edit User
  const startEditUser = (user) => {
    setEditingUser(user);
    setEditUserForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'user',
      dealer_group_ids: user.dealer_group_ids || '',
      store_ids: user.store_ids || '',
      daily_summary_enabled: Boolean(user.daily_summary_enabled),
      appointments_enabled: Boolean(user.appointments_enabled),
      competitor_report_enabled: Boolean(user.competitor_report_enabled),
    });
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      if (editingUser.isPending) {
        await base44.entities.PendingUser.update(editingUser.id, editUserForm);
        qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      } else {
        await base44.entities.User.update(editingUser.id, editUserForm);
        qc.invalidateQueries({ queryKey: ['users'] });
      }
      toast.success('User updated successfully');
      setEditingUser(null);
    } catch (err) {
      toast.error('Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    if (!confirm(`Are you sure you want to remove ${user.full_name || user.email}?`)) return;
    try {
      if (user.isPending) {
        await base44.entities.PendingUser.delete(user.id);
        qc.invalidateQueries({ queryKey: ['pendingUsers'] });
      } else {
        await base44.entities.User.delete(user.id);
        qc.invalidateQueries({ queryKey: ['users'] });
      }
      toast.success('User removed from team');
    } catch (err) {
      toast.error('Failed to remove user');
    }
  };

  // Start Create Role
  const openCreateRole = () => {
    setRoleModalMode('create');
    setEditingRole(null);
    setRoleForm({
      name: '',
      slug: '',
      description: '',
      modules: ['lead_performance', 'appointments', 'salesperson_activity'],
    });
  };

  // Start Edit (Update) Role
  const openEditRole = (role) => {
    setRoleModalMode('edit');
    setEditingRole(role);
    const existingPerms = parsePermissions(role.permissions);
    setRoleForm({
      name: role.name,
      slug: role.slug,
      description: role.description || '',
      modules: existingPerms,
    });
  };

  // Save Role (Create or Update)
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    setSavingRole(true);
    try {
      if (roleModalMode === 'create') {
        const slug = roleForm.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

        if (roles.some(r => r.slug === slug)) {
          toast.error('A role with this name already exists');
          setSavingRole(false);
          return;
        }

        await base44.entities.Role.create({
          name: roleForm.name,
          slug: slug,
          description: roleForm.description,
          permissions: JSON.stringify(roleForm.modules),
          is_system: false,
        });
        toast.success(`Role "${roleForm.name}" created successfully!`);
      } else if (roleModalMode === 'edit') {
        await base44.entities.Role.update(editingRole.id, {
          name: roleForm.name,
          description: roleForm.description,
          permissions: JSON.stringify(roleForm.modules),
        });
        toast.success(`Role "${roleForm.name}" updated successfully!`);
      }

      qc.invalidateQueries({ queryKey: ['roles'] });
      setRoleModalMode(null);
      setEditingRole(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async (role) => {
    if (role.is_system) {
      toast.error('System base roles cannot be deleted, but you can edit their permissions anytime.');
      return;
    }
    if (!confirm(`Are you sure you want to delete role "${role.name}"?`)) return;
    try {
      await base44.entities.Role.delete(role.id);
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`Role "${role.name}" deleted`);
    } catch (err) {
      toast.error('Failed to delete role');
    }
  };

  // Helper for Store summary
  const getStoreBadge = (storeIdsStr) => {
    const ids = parseIds(storeIdsStr);
    if (!ids.length || ids.length >= allStores.length) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          All Stores ({allStores.length})
        </span>
      );
    }
    if (ids.length === 1) {
      const s = allStores.find(store => String(store.id) === String(ids[0]));
      return (
        <span className="text-slate-700 font-medium text-xs truncate block max-w-[180px]" title={s?.name}>
          {s?.name || ids[0]}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200" title={ids.join(', ')}>
        {ids.length} Rooftops
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Team & Access Control (RBAC)</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              Live Database
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage dealership staff, rooftop store assignments, and granular module accessibility per role.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Section Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSection('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSection === 'users'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={13} />
              <span>Members</span>
              <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 rounded-full font-black">
                {allUsers.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('roles')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSection === 'roles'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={13} />
              <span>Roles & Modules</span>
              <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 rounded-full font-black">
                {roles.length}
              </span>
            </button>
          </div>

          {activeSection === 'users' ? (
            <Button
              size="sm"
              onClick={() => setShowAddUserModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-xs font-bold gap-1.5 shadow-sm h-8"
            >
              <Plus size={14} /> Add Member
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={openCreateRole}
              className="bg-slate-900 hover:bg-slate-800 text-xs font-bold gap-1.5 shadow-sm h-8"
            >
              <Plus size={14} /> Create Role
            </Button>
          )}
        </div>
      </div>

      {/* SECTION 1: TEAM MEMBERS */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex-1">
              <Search size={14} className="text-slate-400" />
              <Input
                placeholder="Search by staff name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 p-0 text-xs h-6 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-medium h-9"
              >
                <option value="all">All Roles ({roles.length})</option>
                {roles.map(r => (
                  <option key={r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>

              <select
                value={filterStore}
                onChange={(e) => setFilterStore(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-medium h-9 max-w-[200px] truncate"
              >
                <option value="all">All Dealership Stores</option>
                {allStores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Clean Responsive Table without double borders */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-fixed min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="px-4 py-3 w-[28%]">Staff Member</th>
                    <th className="px-3 py-3 w-[20%]">Role (RBAC)</th>
                    <th className="px-3 py-3 w-[18%]">Rooftop Access</th>
                    <th className="px-2 py-3 text-center w-[8%]" title="Morning Daily Briefing (7:00 AM PST)">Morning</th>
                    <th className="px-2 py-3 text-center w-[8%]" title="Nightly Appointments Digest (11:30 PM PST)">Nightly</th>
                    <th className="px-2 py-3 text-center w-[8%]" title="Competitor Price & Specials Digest">Comp Alert</th>
                    <th className="px-3 py-3 text-right w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No team members found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm">
                              {u.full_name ? u.full_name.slice(0, 2).toUpperCase() : 'DD'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 leading-tight truncate">{u.full_name || '—'}</p>
                              <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border truncate max-w-[150px] ${getRoleBadgeStyle(u.role)}`}>
                            {getRoleDisplayName(u.role)}
                          </span>
                        </td>

                        <td className="px-3 py-3.5">
                          {getStoreBadge(u.store_ids)}
                        </td>

                        {/* Morning Digest Checkbox */}
                        <td className="px-2 py-3.5 text-center">
                          <Checkbox
                            checked={Boolean(u.daily_summary_enabled)}
                            onCheckedChange={() => toggleNotification(u, 'daily_summary_enabled')}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mx-auto"
                          />
                        </td>

                        {/* Nightly Digest Checkbox */}
                        <td className="px-2 py-3.5 text-center">
                          <Checkbox
                            checked={Boolean(u.appointments_enabled)}
                            onCheckedChange={() => toggleNotification(u, 'appointments_enabled')}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mx-auto"
                          />
                        </td>

                        {/* Competitor Alert Checkbox */}
                        <td className="px-2 py-3.5 text-center">
                          <Checkbox
                            checked={Boolean(u.competitor_report_enabled)}
                            onCheckedChange={() => toggleNotification(u, 'competitor_report_enabled')}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mx-auto"
                          />
                        </td>

                        <td className="px-3 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEditUser(u)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                              title="Edit user role & store access"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Remove user"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ROLES & MODULE ACCESSIBILITY (RBAC) */}
      {activeSection === 'roles' && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white shrink-0 mt-0.5">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Module Accessibility & Role Management</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Roles allow you to control which intelligence tools and administrative modules your dealership staff can access.
                You can <strong>create custom roles</strong>, <strong>edit capabilities for any role</strong>, or <strong>delete custom roles</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {roles.map((r) => {
              const activeModules = parsePermissions(r.permissions);
              const memberCount = allUsers.filter(u => u.role === r.slug).length;

              return (
                <div
                  key={r.id || r.slug}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{r.name}</h4>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{r.slug}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                        r.is_system ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {r.is_system ? 'System' : 'Custom'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                      {r.description || 'Dealership staff role with customized module permissions.'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Module Access</span>
                        <span className="font-black text-blue-600">
                          {activeModules.length} of {APP_MODULES.length} modules
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {APP_MODULES.map((mod) => {
                          const isEnabled = activeModules.includes(mod.id);
                          return (
                            <span
                              key={mod.id}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 ${
                                isEnabled
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                            >
                              <span className={`w-1 h-1 rounded-full ${isEnabled ? 'bg-blue-600' : 'bg-slate-300'}`} />
                              {mod.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      <strong className="text-slate-800">{memberCount}</strong> {memberCount === 1 ? 'member' : 'members'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditRole(r)}
                        className="text-xs h-7 px-2.5 font-semibold text-slate-700 hover:text-slate-900 gap-1 border-slate-200"
                      >
                        <Edit2 size={12} /> Edit Role
                      </Button>
                      {!r.is_system && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRole(r)}
                          className="text-xs h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete custom role"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ROLE WITH MODULE ACCESS ACCESSIBILITIES */}
      <Dialog open={!!roleModalMode} onOpenChange={(open) => !open && setRoleModalMode(null)}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              {roleModalMode === 'create' ? 'Create New RBAC Role' : `Edit Role — ${editingRole?.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure complete module access and capabilities for this role across the performance suite.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRole} className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Role Name
                </label>
                <Input
                  placeholder="e.g. BDC Specialist, Used Car Manager"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(f => ({ ...f, name: e.target.value }))}
                  className="text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Role Identifier (Slug)
                </label>
                <Input
                  value={
                    roleModalMode === 'edit'
                      ? roleForm.slug
                      : roleForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'auto_generated'
                  }
                  disabled
                  className="text-xs bg-slate-50 font-mono text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Description & Responsibilities
              </label>
              <Input
                placeholder="Brief summary of what this staff role is responsible for"
                value={roleForm.description}
                onChange={(e) => setRoleForm(f => ({ ...f, description: e.target.value }))}
                className="text-xs"
              />
            </div>

            {/* Complete Module Access Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Complete Module Accessibility ({roleForm.modules.length} Enabled)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRoleForm(f => ({ ...f, modules: APP_MODULES.map(m => m.id) }))}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setRoleForm(f => ({ ...f, modules: [] }))}
                    className="text-[11px] font-bold text-slate-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60 max-h-72 overflow-y-auto">
                {APP_MODULES.map((mod) => {
                  const Icon = mod.icon;
                  const isChecked = roleForm.modules.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      onClick={() => {
                        const next = isChecked
                          ? roleForm.modules.filter(id => id !== mod.id)
                          : [...roleForm.modules, mod.id];
                        setRoleForm(f => ({ ...f, modules: next }));
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-white border-blue-300 shadow-xs'
                          : 'bg-white/50 border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => {}}
                          className="data-[state=checked]:bg-blue-600 shrink-0"
                        />
                        <div className={`p-1.5 rounded-lg bg-slate-100 ${mod.color} shrink-0`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 leading-tight">{mod.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{mod.description}</p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                        isChecked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {isChecked ? 'Full Access' : 'No Access'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRoleModalMode(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingRole} className="bg-blue-600 hover:bg-blue-500 font-bold">
                {savingRole ? 'Saving...' : roleModalMode === 'create' ? 'Create Role' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADD TEAM MEMBER */}
      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">Add Dealership Staff Member</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provision a new account, assign their operational RBAC role, and configure store access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Full Name
              </label>
              <Input
                placeholder="e.g. Jordan Miller"
                value={addUserForm.full_name}
                onChange={(e) => setAddUserForm(f => ({ ...f, full_name: e.target.value }))}
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="staff@dealership.com"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm(f => ({ ...f, email: e.target.value }))}
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Assigned RBAC Role
              </label>
              <select
                value={addUserForm.role}
                onChange={(e) => setAddUserForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 font-medium"
              >
                {roles.map(r => (
                  <option key={r.slug} value={r.slug}>
                    {r.name} {r.is_system ? '(System)' : '(Custom)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Store Access selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Rooftop Store Access
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {allStores.map(store => {
                  const currentIds = parseIds(addUserForm.store_ids);
                  const isChecked = currentIds.includes(String(store.id));
                  return (
                    <label key={store.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          const next = isChecked
                            ? currentIds.filter(id => id !== String(store.id))
                            : [...currentIds, String(store.id)];
                          setAddUserForm(f => ({ ...f, store_ids: next.join(',') }));
                        }}
                      />
                      <span className="truncate">{store.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Email digest checkboxes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Notification Subscriptions
              </label>
              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={addUserForm.daily_summary_enabled}
                    onCheckedChange={(c) => setAddUserForm(f => ({ ...f, daily_summary_enabled: Boolean(c) }))}
                  />
                  <span>Morning Daily Summary (7:00 AM PST)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={addUserForm.appointments_enabled}
                    onCheckedChange={(c) => setAddUserForm(f => ({ ...f, appointments_enabled: Boolean(c) }))}
                  />
                  <span>Nightly Appointments & Activity Digest (11:30 PM PST)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={addUserForm.competitor_report_enabled}
                    onCheckedChange={(c) => setAddUserForm(f => ({ ...f, competitor_report_enabled: Boolean(c) }))}
                  />
                  <span>Competitor Price Drop & Vehicle Specials Alert</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddUserModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={addingUser} className="bg-blue-600 hover:bg-blue-500 font-bold">
                {addingUser ? 'Adding...' : 'Add Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDIT TEAM MEMBER */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Edit Staff Member — {editingUser?.full_name || editingUser?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Full Name
              </label>
              <Input
                value={editUserForm.full_name || ''}
                onChange={(e) => setEditUserForm(f => ({ ...f, full_name: e.target.value }))}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Role (RBAC)
              </label>
              <select
                value={editUserForm.role || 'user'}
                onChange={(e) => setEditUserForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 font-medium"
              >
                {roles.map(r => (
                  <option key={r.slug} value={r.slug}>
                    {r.name} {r.is_system ? '(System)' : '(Custom)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Rooftop Store Access
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {allStores.map(store => {
                  const currentIds = parseIds(editUserForm.store_ids);
                  const isChecked = currentIds.includes(String(store.id));
                  return (
                    <label key={store.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          const next = isChecked
                            ? currentIds.filter(id => id !== String(store.id))
                            : [...currentIds, String(store.id)];
                          setEditUserForm(f => ({ ...f, store_ids: next.join(',') }));
                        }}
                      />
                      <span className="truncate">{store.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Automated Email Digests
              </label>
              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editUserForm.daily_summary_enabled}
                    onCheckedChange={(c) => setEditUserForm(f => ({ ...f, daily_summary_enabled: Boolean(c) }))}
                  />
                  <span>Morning Daily Summary</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editUserForm.appointments_enabled}
                    onCheckedChange={(c) => setEditUserForm(f => ({ ...f, appointments_enabled: Boolean(c) }))}
                  />
                  <span>Nightly Appointments Digest</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editUserForm.competitor_report_enabled}
                    onCheckedChange={(c) => setEditUserForm(f => ({ ...f, competitor_report_enabled: Boolean(c) }))}
                  />
                  <span>Competitor Price Drop Alerts</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={savingEdit} onClick={handleSaveEditUser} className="bg-slate-900 hover:bg-slate-800 font-bold">
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
