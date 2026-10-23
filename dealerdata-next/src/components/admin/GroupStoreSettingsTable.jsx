import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, ChevronDown, ChevronRight, Building2, Users, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import StoreCompetitors from '@/components/admin/StoreCompetitors';

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
];

function GroupRow({ group, stores }) {
  const [open, setOpen] = useState(false);
  const [addingStore, setAddingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreKey, setNewStoreKey] = useState('');
  const [form, setForm] = useState({
    name: group.name || '',
    slug: group.slug || '',
    timezone: group.timezone || '',
  });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const save = async () => {
    setSaving(true);
    await base44.entities.DealerGroup.update(group.id, { name: form.name, slug: form.slug, timezone: form.timezone });
    qc.invalidateQueries({ queryKey: ['dealerGroups'] });
    toast.success('Group saved');
    setSaving(false);
    setOpen(false);
  };

  const deleteGroup = async () => {
    if (!confirm(`Delete group "${group.name}"? This does not delete the stores inside it.`)) return;
    await base44.entities.DealerGroup.delete(group.id);
    qc.invalidateQueries({ queryKey: ['dealerGroups'] });
    toast.success('Group removed');
  };

  const addStore = async () => {
    if (!newStoreName.trim()) return;
    await base44.entities.Store.create({ name: newStoreName.trim(), dealership_key: newStoreKey.trim(), group_id: group.id, active: true });
    qc.invalidateQueries({ queryKey: ['stores'] });
    setNewStoreName(''); setNewStoreKey(''); setAddingStore(false);
    toast.success('Store added');
  };

  const groupStores = stores.filter(s => String(s.group_id) === String(group.id));

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-left flex-1">
              {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
              <Users size={14} className="text-blue-500 shrink-0" />
              <span className="font-semibold text-gray-800 text-sm">{group.name}</span>
              <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Group</span>
            </button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 hover:text-red-500 shrink-0" onClick={deleteGroup} title="Delete group">
              <Trash2 size={12} />
            </Button>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{group.slug || <span className="text-gray-300 italic">no dealer id</span>}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{group.timezone || '—'}</td>
        <td className="px-4 py-3 text-xs text-gray-400">—</td>
      </tr>
      {open && (
        <tr className="border-b border-blue-100 bg-blue-50/40">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dealer ID</label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="h-8 text-sm font-mono" placeholder="e.g. aaron_automotive_group" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
                <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm bg-white">
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800 gap-1.5 h-8" onClick={save} disabled={saving}>
                <Save size={12} /> {saving ? 'Saving…' : 'Save Group'}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
            {/* Add store inline */}
            {addingStore ? (
              <div className="flex gap-2 items-center border-t border-blue-100 pt-3">
                <Input placeholder="Store name *" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} className="h-8 text-sm flex-1" />
                <Input placeholder="Dealership key" value={newStoreKey} onChange={e => setNewStoreKey(e.target.value)} className="h-8 text-sm flex-1" />
                <Button size="sm" className="h-8 bg-slate-900 hover:bg-slate-800" onClick={addStore}>Add</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingStore(false)}>Cancel</Button>
              </div>
            ) : (
              <button onClick={() => setAddingStore(true)} className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium border-t border-blue-100 pt-3 w-full">
                <Plus size={12} /> Add store to this group
              </button>
            )}
          </td>
        </tr>
      )}
      {groupStores.map(store => <StoreRow key={store.id} store={store} indent />)}
    </>
  );
}

function StoreRow({ store, indent = false }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: store.name || '',
    dealership_key: store.dealership_key || '',
    timezone: store.timezone || 'America/Los_Angeles',
    scraper_store_id: store.scraper_store_id || '',
  });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const save = async () => {
    setSaving(true);
    // All stores scrape daily automatically — scrape_frequency is never user-editable.
    await base44.entities.Store.update(store.id, { ...form, scrape_frequency: 'daily' });
    qc.invalidateQueries({ queryKey: ['stores'] });
    toast.success('Store saved');
    setSaving(false);
    setOpen(false);
  };

  const deleteStore = async () => {
    if (!confirm(`Delete store "${store.name}"?`)) return;
    await base44.entities.Store.delete(store.id);
    qc.invalidateQueries({ queryKey: ['stores'] });
    toast.success('Store removed');
  };

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className={`px-4 py-3 ${indent ? 'pl-10' : ''}`}>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-left flex-1">
              {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
              <Building2 size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">{store.name}</span>
            </button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 hover:text-red-500 shrink-0" onClick={deleteStore} title="Delete store">
              <Trash2 size={12} />
            </Button>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{store.dealership_key || '—'}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{store.timezone || '—'}</td>
      </tr>
      {open && (
        <tr className="border-b border-green-100 bg-green-50/30">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Store Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dealership Key</label>
                <Input value={form.dealership_key} onChange={e => setForm(f => ({ ...f, dealership_key: e.target.value }))} className="h-8 text-sm" placeholder="e.g. Aaron Chevrolet" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
                <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm bg-white">
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Scraper Store ID <span className="text-gray-400 font-normal">(internal)</span></label>
                <Input value={form.scraper_store_id} onChange={e => setForm(f => ({ ...f, scraper_store_id: e.target.value }))} className="h-8 text-sm font-mono" placeholder="e.g. store_001" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800 gap-1.5 h-8" onClick={save} disabled={saving}>
                <Save size={12} /> {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
            <StoreCompetitors storeId={store.id} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function GroupStoreSettingsTable({ groups, stores }) {
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreKey, setNewStoreKey] = useState('');
  const [newStoreGroupId, setNewStoreGroupId] = useState('');
  const qc = useQueryClient();

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    await base44.entities.DealerGroup.create({ name: newGroupName.trim() });
    qc.invalidateQueries({ queryKey: ['dealerGroups'] });
    setNewGroupName(''); setShowAddGroup(false);
    toast.success('Group added');
  };

  const addStore = async () => {
    if (!newStoreName.trim()) return;
    await base44.entities.Store.create({
      name: newStoreName.trim(),
      dealership_key: newStoreKey.trim(),
      group_id: newStoreGroupId || '',
      active: true,
    });
    qc.invalidateQueries({ queryKey: ['stores'] });
    setNewStoreName(''); setNewStoreKey(''); setNewStoreGroupId(''); setShowAddStore(false);
    toast.success('Store added');
  };

  const orphanStores = stores.filter(s => !groups.some(g => String(g.id) === String(s.group_id)));

  return (
    <div className="space-y-3">
      {/* Action bar above the table */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {showAddGroup && (
          <div className="flex gap-2 items-center flex-wrap flex-1">
            <span className="text-sm font-semibold text-gray-700">New Dealer Group:</span>
            <Input placeholder="Group name *" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="text-sm h-8 w-56" />
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 h-8" onClick={addGroup}>Create</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setShowAddGroup(false)}>Cancel</Button>
          </div>
        )}
        {showAddStore && (
          <div className="flex gap-2 items-center flex-wrap flex-1">
            <span className="text-sm font-semibold text-gray-700">New Store:</span>
            <Input placeholder="Store name *" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} className="text-sm h-8 w-44" />
            <Input placeholder="Dealership key" value={newStoreKey} onChange={e => setNewStoreKey(e.target.value)} className="text-sm h-8 w-44" />
            <select value={newStoreGroupId} onChange={e => setNewStoreGroupId(e.target.value)} className="h-8 border border-gray-200 rounded-md px-2 text-sm bg-white w-44">
              <option value="">No group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 h-8" onClick={addStore}>Add</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setShowAddStore(false)}>Cancel</Button>
          </div>
        )}
        {!showAddGroup && !showAddStore && (
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddGroup(true)}>
              <Plus size={13} /> Add Dealer Group
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddStore(true)}>
              <Plus size={13} /> Add Store
            </Button>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Dealer ID</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500">Timezone</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <GroupRow key={group.id} group={group} stores={stores} />
            ))}
            {orphanStores.map(store => (
              <StoreRow key={store.id} store={store} />
            ))}
            {groups.length === 0 && orphanStores.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400 text-sm">No groups or stores configured yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}