import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, ChevronDown, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UnifiedStoreRow from '@/components/admin/UnifiedStoreRow';
import AddStorePanel from '@/components/admin/AddStorePanel';

function GroupHeader({ group, storeCount, open, onToggle, onDeleteGroup }) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-2 px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 border-b border-slate-100 select-none transition-colors"
    >
      {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-400" />}
      <Users size={14} className="text-blue-500" />
      <span className="font-semibold text-gray-800 text-sm">{group.name}</span>
      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Group</span>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-gray-400">{storeCount} store{storeCount !== 1 ? 's' : ''}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteGroup(group, storeCount);
          }}
          title={`Delete entire group "${group.name}" and all stores/competitors`}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}

function OrphanHeader({ open, onToggle, storeCount }) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-2 px-4 py-3 bg-amber-50/70 cursor-pointer hover:bg-amber-100/70 border-b border-amber-100 select-none transition-colors"
    >
      {open ? <ChevronDown size={14} className="text-amber-500" /> : <ChevronRight size={14} className="text-amber-500" />}
      <span className="text-sm font-semibold text-amber-700">Ungrouped Stores</span>
      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">No group</span>
      <span className="text-xs text-amber-600 ml-auto">{storeCount} store{storeCount !== 1 ? 's' : ''}</span>
    </div>
  );
}

export default function UnifiedStoreList({ groups = [], stores = [] }) {
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  const [orphanOpen, setOrphanOpen] = useState(true);
  const qc = useQueryClient();
  const groupId = groups?.[0]?.id || null;

  const { data: competitors = [] } = useQuery({
    queryKey: ['allCompetitors'],
    queryFn: () => base44.entities.StoreCompetitor.list('name', 500),
  });

  const toggleGroup = (id) => {
    setOpenGroups(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await base44.entities.DealerGroup.create({ name: newGroupName.trim() });
      qc.invalidateQueries({ queryKey: ['dealerGroups'] });
      setNewGroupName('');
      setAddGroupOpen(false);
      toast.success('Group added');
    } catch (e) {
      toast.error('Failed to add group');
    }
  };

  const deleteGroup = async (group, storeCount) => {
    const msg = storeCount > 0
      ? `Are you sure you want to delete the entire group "${group.name}"?\n\nWARNING: This will permanently delete the group, all ${storeCount} store(s) inside it, and all of their competitors and scraped inventory data.`
      : `Delete dealer group "${group.name}"?`;
    if (!confirm(msg)) return;

    try {
      await base44.entities.DealerGroup.delete(group.id);
      qc.invalidateQueries({ queryKey: ['dealerGroups'] });
      qc.invalidateQueries({ queryKey: ['stores'] });
      qc.invalidateQueries({ queryKey: ['allStores'] });
      qc.invalidateQueries({ queryKey: ['allCompetitors'] });
      toast.success(`Group "${group.name}" and all associated stores/competitors deleted`);
    } catch (e) {
      toast.error(e?.message || 'Failed to delete group');
    }
  };

  // Group stores by group_id; orphan stores have no group
  const orphanStores = stores.filter(s => !groups.some(g => String(g.id) === String(s.group_id)));
  const grouped = groups.map(g => ({
    group: g,
    stores: stores.filter(s => String(s.group_id) === String(g.id)),
  }));

  return (
    <div className="space-y-4">
      <AddStorePanel
        stores={stores}
        competitors={competitors}
        addGroupOpen={addGroupOpen}
        setAddGroupOpen={setAddGroupOpen}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        onAddGroup={addGroup}
      />

      <h2 className="text-sm font-semibold text-gray-700">Existing Stores</h2>

      {addGroupOpen && (
        <div className="flex gap-2 items-center bg-white border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-sm font-semibold text-gray-700">New Group:</span>
          <Input placeholder="Group name *" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="text-sm h-8 w-56" />
          <Button size="sm" className="h-8" onClick={addGroup}>Create</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setAddGroupOpen(false)}>Cancel</Button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {stores.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            <RefreshCw className="animate-spin mx-auto mb-2 text-gray-300" size={20} />
            No stores yet — use "Add New Client Store" above to create your first store.
          </div>
        )}

        {grouped.map(({ group, stores: gStores }) => {
          const isOpen = openGroups[group.id] ?? true;
          return (
            <div key={group.id} className="border-b border-gray-100 last:border-b-0">
              <GroupHeader
                group={group}
                storeCount={gStores.length}
                open={isOpen}
                onToggle={() => toggleGroup(group.id)}
                onDeleteGroup={deleteGroup}
              />
              {isOpen && (
                <div>
                  {gStores.length > 0
                    ? gStores.map(store => <UnifiedStoreRow key={store.id} store={store} />)
                    : <p className="px-4 py-3 text-sm text-gray-400 italic">No stores yet in this group — use "Add New Client Store" above.</p>}
                </div>
              )}
            </div>
          );
        })}

        {orphanStores.length > 0 && (
          <div className="border-b border-gray-100 last:border-b-0">
            <OrphanHeader
              open={orphanOpen}
              onToggle={() => setOrphanOpen(o => !o)}
              storeCount={orphanStores.length}
            />
            {orphanOpen && (
              <div>
                {orphanStores.map(store => <UnifiedStoreRow key={store.id} store={store} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}