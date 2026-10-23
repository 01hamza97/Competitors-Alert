import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

function toggleId(currentStr, id) {
  const ids = currentStr ? currentStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  const exists = ids.includes(String(id));
  const next = exists ? ids.filter(i => i !== String(id)) : [...ids, String(id)];
  return next.join(',');
}

function hasId(str, id) {
  if (!str) return false;
  return str.split(',').map(s => s.trim()).includes(String(id));
}

export default function PendingUserForm({ selectedGroupId, selectedStoreId, allGroups, allStores, onUserAdded }) {
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'user',
    dealer_group_ids: selectedGroupId || '',
    store_ids: selectedStoreId || '',
    daily_summary_enabled: false,
    appointments_enabled: false,
    competitor_report_enabled: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error('Email is required');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.PendingUser.create(form);
      toast.success('User pre-setup added. Send invite to proceed.');
      setForm({
        email: '',
        full_name: '',
        role: 'user',
        dealer_group_ids: selectedGroupId || '',
        store_ids: selectedStoreId || '',
        daily_summary_enabled: false,
        appointments_enabled: false,
        competitor_report_enabled: false,
      });
      onUserAdded?.();
    } catch (e) {
      toast.error(e.message || 'Failed to add user');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-gray-300 rounded-lg p-5 space-y-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900">Pre-Setup New User</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
          <Input
            type="email"
            placeholder="user@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="text-sm h-8"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
          <Input
            placeholder="John Smith"
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            className="text-sm h-8"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white w-full h-8"
          >
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Groups */}
      {allGroups?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Dealer Groups</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allGroups.map(g => (
              <label key={g.id} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                <Checkbox
                  checked={hasId(form.dealer_group_ids, g.id)}
                  onCheckedChange={() => setForm(f => ({ ...f, dealer_group_ids: toggleId(f.dealer_group_ids, g.id) }))}
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Stores */}
      {allStores?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Stores</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allStores.map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                <Checkbox
                  checked={hasId(form.store_ids, s.id)}
                  onCheckedChange={() => setForm(f => ({ ...f, store_ids: toggleId(f.store_ids, s.id) }))}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Email Preferences */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Email Preferences</p>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={form.daily_summary_enabled}
              onCheckedChange={c => setForm(f => ({ ...f, daily_summary_enabled: c }))}
            />
            <span className="text-xs text-gray-600">Daily Summary</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={form.appointments_enabled}
              onCheckedChange={c => setForm(f => ({ ...f, appointments_enabled: c }))}
            />
            <span className="text-xs text-gray-600">Appointments</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={form.competitor_report_enabled}
              onCheckedChange={c => setForm(f => ({ ...f, competitor_report_enabled: c }))}
            />
            <span className="text-xs text-gray-600">Competitor Report</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          size="sm"
          className="bg-slate-900 hover:bg-slate-800 gap-1.5 h-8"
          disabled={saving}
        >
          <Plus size={13} />
          {saving ? 'Adding...' : 'Add User'}
        </Button>
      </div>
    </form>
  );
}