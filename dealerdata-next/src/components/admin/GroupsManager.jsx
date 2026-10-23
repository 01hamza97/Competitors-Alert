import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/SectionCard';
import { Plus, Trash2, ChevronDown, ChevronRight, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';

function StoreRow({ store, onDelete }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2">
        <Building2 size={13} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{store.name}</span>
        {store.dealership_key && (
          <span className="text-xs text-gray-400 font-mono">({store.dealership_key})</span>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => onDelete(store)}>
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

function GroupRow({ group, stores, onDeleteGroup }) {
  const [expanded, setExpanded] = useState(true);
  const [addingStore, setAddingStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeKey, setStoreKey] = useState('');
  const qc = useQueryClient();

  const groupStores = stores.filter(s => s.group_id === group.id);

  const addStore = async () => {
    if (!storeName.trim()) return;
    await base44.entities.Store.create({ name: storeName.trim(), dealership_key: storeKey.trim(), group_id: group.id, active: true });
    qc.invalidateQueries({ queryKey: ['stores'] });
    setStoreName(''); setStoreKey(''); setAddingStore(false);
    toast.success('Store added');
  };

  const deleteStore = async (store) => {
    await base44.entities.Store.delete(store.id);
    qc.invalidateQueries({ queryKey: ['stores'] });
    toast.success('Store removed');
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
          <Users size={15} className="text-blue-500" />
          <span className="font-semibold text-gray-800">{group.name}</span>
          <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{groupStores.length} store{groupStores.length !== 1 ? 's' : ''}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteGroup(group); }}>
          <Trash2 size={13} />
        </Button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-gray-50/50 space-y-2">
          {groupStores.map(s => <StoreRow key={s.id} store={s} onDelete={deleteStore} />)}

          {addingStore ? (
            <div className="flex gap-2 mt-2">
              <Input placeholder="Store name" value={storeName} onChange={e => setStoreName(e.target.value)} className="flex-1 h-8 text-sm" />
              <Input placeholder="Dealership key (matches data)" value={storeKey} onChange={e => setStoreKey(e.target.value)} className="flex-1 h-8 text-sm" />
              <Button size="sm" className="h-8 bg-slate-900 hover:bg-slate-800" onClick={addStore}>Add</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingStore(false)}>Cancel</Button>
            </div>
          ) : (
            <button onClick={() => setAddingStore(true)} className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium mt-1">
              <Plus size={12} /> Add store
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupsManager({ groups, stores }) {
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [principalEmails, setPrincipalEmails] = useState('');
  const qc = useQueryClient();

  const addGroup = async () => {
    if (!groupName.trim()) return;
    await base44.entities.DealerGroup.create({ name: groupName.trim(), principal_name: principalName.trim(), principal_emails: principalEmails.trim() });
    qc.invalidateQueries({ queryKey: ['dealerGroups'] });
    setGroupName(''); setPrincipalName(''); setPrincipalEmails(''); setShowAddGroup(false);
    toast.success('Group added');
  };

  const deleteGroup = async (group) => {
    const groupStores = stores.filter(s => s.group_id === group.id);
    const msg = groupStores.length > 0
      ? `Are you sure you want to delete the entire group "${group.name}"?\n\nWARNING: This will permanently delete the group, all ${groupStores.length} store(s) inside it, and all of their competitors.`
      : `Delete dealer group "${group.name}"?`;
    if (!confirm(msg)) return;

    await base44.entities.DealerGroup.delete(group.id);
    qc.invalidateQueries({ queryKey: ['dealerGroups'] });
    qc.invalidateQueries({ queryKey: ['stores'] });
    qc.invalidateQueries({ queryKey: ['allStores'] });
    qc.invalidateQueries({ queryKey: ['allCompetitors'] });
    toast.success(`Group "${group.name}" and all associated stores/competitors deleted`);
  };

  return (
    <SectionCard title="Dealer Groups & Stores">
      <div className="space-y-3">
        {groups.map(g => (
          <GroupRow key={g.id} group={g} stores={stores} onDeleteGroup={deleteGroup} />
        ))}

        {groups.length === 0 && !showAddGroup && (
          <p className="text-gray-400 text-sm py-2">No groups yet. Add your first dealer group below.</p>
        )}

        {showAddGroup ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-white">
            <p className="text-sm font-semibold text-gray-700">New Dealer Group</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Group name *" value={groupName} onChange={e => setGroupName(e.target.value)} className="text-sm" />
              <Input placeholder="Dealer Principal name" value={principalName} onChange={e => setPrincipalName(e.target.value)} className="text-sm" />
              <Input placeholder="Principal email(s), comma-separated" value={principalEmails} onChange={e => setPrincipalEmails(e.target.value)} className="text-sm" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={addGroup}>Create Group</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddGroup(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 mt-1" onClick={() => setShowAddGroup(true)}>
            <Plus size={13} /> Add Dealer Group
          </Button>
        )}
      </div>
    </SectionCard>
  );
}