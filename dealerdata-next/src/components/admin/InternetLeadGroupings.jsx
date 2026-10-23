import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useLeadPerformanceRangeRaw } from '@/lib/useSupabaseData';
import { format, subMonths } from 'date-fns';

const PARTY_OPTIONS = ['1st Party', '3rd Party'];

function useInternetSources(dealershipKeys) {
  const end = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  const start = format(subMonths(new Date(), 2), 'yyyy-MM-dd');
  const keys = Array.isArray(dealershipKeys) ? dealershipKeys : (dealershipKeys ? [dealershipKeys] : []);
  const { data: rows = [] } = useLeadPerformanceRangeRaw(keys, start, end, keys.length > 0);

  // Returns { sources: string[], sourceToKeys: { [source]: Set<normalized_dealer_id> } }
  // Tracks ALL dealer_ids that have a given source (multiple stores can share a source name)
  // NOTE: normalizeLPRow already normalizes dealer_id (lowercase + underscores)
  return useMemo(() => {
    const sourceToKeys = {};
    rows.forEach(r => {
      if (r.lead_type === 'Internet' && r.lead_source && r.dealer_id) {
        if (!sourceToKeys[r.lead_source]) sourceToKeys[r.lead_source] = new Set();
        sourceToKeys[r.lead_source].add(r.dealer_id);
      }
    });
    return { sources: Object.keys(sourceToKeys).sort(), sourceToKeys };
  }, [rows]);
}

// ─── Single-store mode components ────────────────────────────────────────────

function GroupCard({ group, onSave, onDelete, onSelect, isSelected }) {
  const [form, setForm] = useState({
    group_name: group.group_name,
    party_type: group.party_type || '3rd Party',
    raw_sources: group.raw_sources ? group.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(f => ({
      ...f,
      raw_sources: group.raw_sources ? group.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : [],
    }));
  }, [group.raw_sources]);

  const removeSource = (s) => setForm(f => ({ ...f, raw_sources: f.raw_sources.filter(x => x !== s) }));

  const save = async () => {
    setSaving(true);
    await onSave(group.id, { group_name: form.group_name, party_type: form.party_type, raw_sources: form.raw_sources.join('|') });
    setSaving(false);
  };

  const partyColor = form.party_type === '1st Party'
    ? 'bg-blue-100 text-blue-700 border-blue-200'
    : 'bg-purple-100 text-purple-700 border-purple-200';

  return (
    <div className={`border rounded-lg bg-white overflow-hidden transition-all ${isSelected ? 'border-blue-400 shadow-md' : 'border-gray-200'}`}>
      <button
        onClick={() => onSelect(isSelected ? null : group.id)}
        className={`w-full px-4 py-3 flex items-center justify-between ${isSelected ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-800">{form.group_name || 'Unnamed Group'}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${partyColor}`}>{form.party_type}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(group.id); }}>
          <Trash2 size={13} />
        </Button>
      </button>

      {isSelected && (
        <div className="p-4 space-y-3 border-t border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Input value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))} className="text-xs h-7 flex-1" placeholder="Group name..." />
            <div className="flex gap-1">
              {PARTY_OPTIONS.map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, party_type: p }))}
                  className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${form.party_type === p ? partyColor : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                  {p}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={save} disabled={saving}>
              <Save size={10} /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1.5">Assigned Sources (click X to remove)</p>
            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
              {form.raw_sources.length === 0 ? (
                <span className="text-xs text-gray-400 italic">None assigned — click sources from the left</span>
              ) : form.raw_sources.map(s => (
                <button key={s} onClick={() => removeSource(s)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-white text-xs rounded-full font-medium hover:bg-red-500 transition-colors">
                  {s} <X size={9} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── All-stores mode components ───────────────────────────────────────────────

// A card representing one "platform group name" (e.g. "AutoTrader") showing
// per-store assignment status and allowing drag-click assignment.
function PlatformGroupCard({ groupName, storeRecords, allStores, onRemoveSourceFromStore, onDeleteGroupName, onRenameGroup, isSelected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(groupName);

  // Build a map: storeId → record (may be undefined if store has no record with this name)
  const storeMap = useMemo(() => {
    const m = {};
    storeRecords.forEach(r => { m[r.store_id] = r; });
    return m;
  }, [storeRecords]);

  const partyType = storeRecords[0]?.party_type || '3rd Party';
  const partyColor = partyType === '1st Party' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200';

  const totalSources = useMemo(() => {
    const all = new Set();
    storeRecords.forEach(r => {
      if (r.raw_sources) r.raw_sources.split('|').map(s => s.trim()).filter(Boolean).forEach(s => all.add(s));
    });
    return [...all].sort();
  }, [storeRecords]);

  return (
    <div className={`border rounded-lg bg-white overflow-hidden transition-all ${isSelected ? 'border-blue-400 shadow-md' : 'border-gray-200'}`}>
      <button
        onClick={() => { onSelect(isSelected ? null : groupName); setExpanded(true); }}
        className={`w-full px-4 py-3 flex items-center justify-between ${isSelected ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          {expanded ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
          {editingName ? (
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Enter') { onRenameGroup(groupName, newName); setEditingName(false); }
                if (e.key === 'Escape') { setNewName(groupName); setEditingName(false); }
              }}
              className="text-xs h-7 w-40"
              autoFocus
            />
          ) : (
            <p className="text-sm font-semibold text-gray-800">{groupName}</p>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${partyColor}`}>{partyType}</span>
          <span className="text-xs text-gray-400">{totalSources.length} source{totalSources.length !== 1 ? 's' : ''} · {storeRecords.length} store{storeRecords.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-300 hover:text-blue-500"
            onClick={() => { setEditingName(true); setExpanded(true); }} title="Rename group">
            <Save size={11} />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-300 hover:text-red-500"
            onClick={() => onDeleteGroupName(groupName)} title="Delete this group from all stores">
            <Trash2 size={12} />
          </Button>
        </div>
      </button>

      {isSelected && expanded && (
        <div className="p-4 border-t border-blue-200 bg-blue-50 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Sources</p>
          <div className="flex flex-wrap gap-1.5">
            {allStores.flatMap(store => {
              const record = storeMap[store.id];
              if (!record?.raw_sources) return [];
              return record.raw_sources.split('|').map(s => s.trim()).filter(Boolean).map(s => ({ s, store, record }));
            }).length === 0 ? (
              <span className="text-xs text-gray-300 italic">No sources assigned yet</span>
            ) : allStores.flatMap(store => {
              const record = storeMap[store.id];
              if (!record?.raw_sources) return [];
              return record.raw_sources.split('|').map(s => s.trim()).filter(Boolean).map(s => ({ s, store, record }));
            }).map(({ s, store, record }) => (
              <button
                key={`${store.id}-${s}`}
                onClick={() => onRemoveSourceFromStore(store, groupName, record, s)}
                title={`From ${store.name} — click to remove`}
                className="flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-white text-xs rounded-full font-medium hover:bg-red-500 transition-colors">
                {s} <X size={9} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InternetLeadGroupings({ store, allStores }) {
  const qc = useQueryClient();
  const isAllMode = !!allStores && !store;

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParty, setNewParty] = useState('3rd Party');
  const [addStoreId, setAddStoreId] = useState(allStores?.[0]?.id || '');
  const [selectedGroupId, setSelectedGroupId] = useState(null);      // single-store mode
  const [selectedGroupName, setSelectedGroupName] = useState(null);  // all-stores mode: which platform group is "active target"

  const dealershipKeys = isAllMode
    ? (allStores || []).map(s => s.dealership_key).filter(Boolean)
    : [store?.dealership_key];

  // Fetch groups first so we can use their dealership_keys in the sources query
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['internetLeadGroups', isAllMode ? '__all__' : store?.id],
    enabled: isAllMode ? allStores?.length > 0 : !!store?.id,
    queryFn: isAllMode
      ? () => Promise.all(
          (allStores || []).map(s => base44.entities.InternetLeadGroup.filter({ store_id: s.id }, 'sort_order', 200))
        ).then(results => results.flat())
      : () => base44.entities.InternetLeadGroup.filter({ store_id: store.id }, 'sort_order', 200),
  });

  // Also include dealership_keys stored on group records themselves — these are the actual
  // Supabase dealer_ids and may differ slightly from the Store entity's dealership_key field.
  // This ensures allSources covers all stores even if there's a key mismatch.
  const groupDealershipKeys = useMemo(() => {
    const keys = new Set(dealershipKeys);
    groups.forEach(g => { if (g.dealership_key) keys.add(g.dealership_key); });
    return [...keys].filter(Boolean);
  }, [dealershipKeys, groups]);

  const { sources: allSources, sourceToKeys } = useInternetSources(groupDealershipKeys);

  const storeIds = isAllMode ? (allStores || []).map(s => s.id) : [store?.id];

  const invalidateGroups = () => {
    qc.invalidateQueries({ queryKey: ['internetLeadGroups', isAllMode ? '__all__' : store?.id] });
    qc.invalidateQueries({ queryKey: ['unassignedSources'] });
  };

  // ── Single-store helpers ──────────────────────────────────────────────────

  const saveGroup = async (id, data) => {
    await base44.entities.InternetLeadGroup.update(id, data);
    invalidateGroups();
    toast.success('Group saved');
  };

  const deleteGroup = async (id) => {
    await base44.entities.InternetLeadGroup.delete(id);
    invalidateGroups();
    toast.success('Group removed');
  };

  const addSourceToGroup = async (source) => {
    if (!selectedGroupId) return;
    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    if (!selectedGroup) return;
    const currentSources = selectedGroup.raw_sources ? selectedGroup.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : [];
    if (!currentSources.includes(source)) {
      currentSources.push(source);
      await base44.entities.InternetLeadGroup.update(selectedGroupId, {
        group_name: selectedGroup.group_name,
        party_type: selectedGroup.party_type,
        raw_sources: currentSources.join('|'),
      });
      invalidateGroups();
      toast.success(`Added "${source}" to group`);
    }
  };

  // ── All-stores helpers ────────────────────────────────────────────────────

  // Group all records by group_name → array of records
  const platformGroups = useMemo(() => {
    if (!isAllMode) return {};
    const map = {};
    groups.forEach(g => {
      if (!map[g.group_name]) map[g.group_name] = [];
      map[g.group_name].push(g);
    });
    return map;
  }, [isAllMode, groups]);

  const platformGroupNames = useMemo(() => Object.keys(platformGroups).sort(), [platformGroups]);

  // Build a per-store map of assigned sources: { store_id → Set<source> }
  const assignedByStore = useMemo(() => {
    const map = {};
    groups.forEach(g => {
      if (!map[g.store_id]) map[g.store_id] = new Set();
      if (g.raw_sources) {
        g.raw_sources.split('|').map(s => s.trim()).filter(Boolean).forEach(s => map[g.store_id].add(s));
      }
    });
    return map;
  }, [groups]);

  // A source is "unassigned" in All Stores mode if ANY store that has that source
  // in its perf data does NOT have it assigned in a group.
  // sourceToKeys maps source → Set<normalized_dealer_id> (multiple stores can share a source name)
  const unassigned = useMemo(() => {
    if (!isAllMode) return [];
    const normalize = (s) => s ? s.trim().toLowerCase().replace(/\s+/g, '_') : '';
    const unassignedSet = new Set();
    allSources.forEach(source => {
      const dealerIds = sourceToKeys[source] || new Set();
      // Check every store that has this source in perf data
      dealerIds.forEach(originKey => {
        const ownerStore = (allStores || []).find(s =>
          normalize(s.dealership_key) === originKey ||
          s.dealership_key === originKey ||
          normalize(s.name) === originKey
        );
        if (!ownerStore) return;
        const storeAssigned = assignedByStore[ownerStore.id] || new Set();
        if (!storeAssigned.has(source)) {
          unassignedSet.add(source);
        }
      });
    });
    return [...unassignedSet].sort();
  }, [isAllMode, allSources, sourceToKeys, allStores, assignedByStore]);

  // Auto-assign a source to ALL its originating stores under the selected platform group
  const handleUnassignedSourceClick = async (source) => {
    if (!selectedGroupName) {
      toast.error('Select a platform group first, then click a source to assign it.');
      return;
    }
    const normalize = (s) => s ? s.trim().toLowerCase().replace(/\s+/g, '_') : '';
    const dealerIds = sourceToKeys[source] || new Set();
    const groupRecords = platformGroups[selectedGroupName] || [];

    // Find all stores that have this source unassigned
    const targetStores = [];
    dealerIds.forEach(originKey => {
      const ownerStore = (allStores || []).find(s =>
        normalize(s.dealership_key) === originKey ||
        s.dealership_key === originKey ||
        normalize(s.name) === originKey
      );
      if (!ownerStore) return;
      const storeAssigned = assignedByStore[ownerStore.id] || new Set();
      if (!storeAssigned.has(source)) targetStores.push(ownerStore);
    });

    if (targetStores.length === 0) {
      toast.error(`Could not find any unassigned store for "${source}".`);
      return;
    }

    await Promise.all(targetStores.map(async (targetStore) => {
      const existingRecord = groupRecords.find(r => r.store_id === targetStore.id);
      if (existingRecord) {
        const currentSources = existingRecord.raw_sources
          ? existingRecord.raw_sources.split('|').map(s => s.trim()).filter(Boolean)
          : [];
        if (!currentSources.includes(source)) {
          currentSources.push(source);
          await base44.entities.InternetLeadGroup.update(existingRecord.id, { ...existingRecord, raw_sources: currentSources.join('|') });
        }
      } else {
        await base44.entities.InternetLeadGroup.create({
          store_id: targetStore.id,
          dealership_key: targetStore.dealership_key || '',
          group_name: selectedGroupName,
          party_type: (platformGroups[selectedGroupName]?.[0]?.party_type) || '3rd Party',
          raw_sources: source,
          sort_order: groups.length,
        });
      }
    }));

    invalidateGroups();
    const storeNames = targetStores.map(s => s.name).join(', ');
    toast.success(`Assigned "${source}" → ${selectedGroupName} (${storeNames})`);
  };

  const removeSourceFromStore = async (targetStore, groupName, record, source) => {
    if (!record) return;
    const currentSources = record.raw_sources
      ? record.raw_sources.split('|').map(s => s.trim()).filter(Boolean)
      : [];
    const updated = currentSources.filter(s => s !== source);
    await base44.entities.InternetLeadGroup.update(record.id, {
      ...record,
      raw_sources: updated.join('|'),
    });
    invalidateGroups();
    toast.success(`Removed "${source}" from ${targetStore.name}`);
  };

  const deletePlatformGroupName = async (groupName) => {
    if (!confirm(`Delete the "${groupName}" group from ALL stores? This cannot be undone.`)) return;
    const records = platformGroups[groupName] || [];
    await Promise.all(records.map(r => base44.entities.InternetLeadGroup.delete(r.id)));
    invalidateGroups();
    toast.success(`Deleted "${groupName}" from all stores`);
  };

  const renamePlatformGroup = async (oldName, newName) => {
    if (!newName.trim() || oldName === newName.trim()) return;
    const records = platformGroups[oldName] || [];
    await Promise.all(records.map(r => base44.entities.InternetLeadGroup.update(r.id, { ...r, group_name: newName.trim() })));
    invalidateGroups();
    toast.success(`Renamed "${oldName}" to "${newName.trim()}"`);
  };

  // ── Add group ─────────────────────────────────────────────────────────────

  const addGroup = async () => {
    if (!newName.trim()) return;
    const targetStoreId = isAllMode ? addStoreId : store.id;
    const targetStore = isAllMode ? (allStores || []).find(s => s.id === targetStoreId) : store;
    await base44.entities.InternetLeadGroup.create({
      store_id: targetStoreId,
      dealership_key: targetStore?.dealership_key || '',
      group_name: newName.trim(),
      party_type: newParty,
      raw_sources: '',
      sort_order: groups.length,
    });
    invalidateGroups();
    setNewName(''); setNewParty('3rd Party'); setShowAdd(false);
    toast.success('Group created');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const assignedSources = useMemo(() =>
    groups.flatMap(g => g.raw_sources ? g.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : []),
    [groups]
  );

  const singleStoreAllKnown = useMemo(() => {
    const set = new Set(allSources);
    groups.forEach(g => {
      if (g.raw_sources) g.raw_sources.split('|').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
    });
    return [...set].sort();
  }, [allSources, groups]);

  const singleStoreUnassigned = useMemo(() =>
    singleStoreAllKnown.filter(s => !assignedSources.includes(s)),
    [singleStoreAllKnown, assignedSources]
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Internet Lead Source Groups</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isAllMode
            ? 'Platform-wide view. Each group name aggregates across all stores. Click a group to assign unassigned sources to a specific store within it.'
            : 'Group internet lead sources and assign 1st or 3rd party. Used in Vendor Performance.'}
        </p>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : isAllMode ? (
        // ── All-stores mode ──────────────────────────────────────────────────
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Unassigned sources */}
          <div className="lg:col-span-1">
            <div className="border border-amber-200 rounded-lg bg-amber-50 p-4 h-full">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
                Unassigned Sources ({unassigned.length})
              </p>
              <p className="text-xs text-amber-500 mb-3">
                {selectedGroupName
                  ? <>Click a source to assign to <strong>"{selectedGroupName}"</strong></>
                  : 'Select a group on the right first'}
              </p>
              <div className="space-y-1.5">
                {unassigned.length === 0 ? (
                  <p className="text-xs text-amber-600 italic">All sources assigned ✓</p>
                ) : unassigned.map(s => (
                  <button key={s} onClick={() => handleUnassignedSourceClick(s)}
                    disabled={!selectedGroupName}
                    className={`w-full px-3 py-1.5 text-left text-xs rounded-lg border font-medium transition-all ${
                      selectedGroupName
                        ? 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-400 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                    title={selectedGroupName ? `Click to assign to "${selectedGroupName}"` : 'Select a group first'}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Platform groups */}
          <div className="lg:col-span-2 space-y-2">
            {platformGroupNames.length === 0 && (
              <p className="text-xs text-gray-400 italic">No groups yet. Add one below.</p>
            )}
            {platformGroupNames.map(name => (
              <PlatformGroupCard
                key={name}
                groupName={name}
                storeRecords={platformGroups[name]}
                allStores={allStores}
                onRemoveSourceFromStore={removeSourceFromStore}
                onDeleteGroupName={deletePlatformGroupName}
                onRenameGroup={renamePlatformGroup}
                isSelected={selectedGroupName === name}
                onSelect={setSelectedGroupName}
              />
            ))}

            {showAdd ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3 bg-white">
                <p className="text-sm font-semibold text-gray-700">New Lead Source Group</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} className="text-sm h-8 flex-1 min-w-40" />
                  <select value={addStoreId} onChange={e => setAddStoreId(e.target.value)}
                    className="h-8 border border-gray-200 rounded-md px-2 text-sm bg-white">
                    {(allStores || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className="flex gap-1">
                    {PARTY_OPTIONS.map(p => (
                      <button key={p} onClick={() => setNewParty(p)}
                        className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${newParty === p
                          ? p === '1st Party' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={addGroup}>Create</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNewName(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setShowAdd(true)}>
                <Plus size={13} /> Add Group
              </Button>
            )}
          </div>
        </div>
      ) : (
        // ── Single-store mode ────────────────────────────────────────────────
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <div className="border border-amber-200 rounded-lg bg-amber-50 p-4 h-full">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">Unassigned Sources ({singleStoreUnassigned.length})</p>
              <div className="space-y-1.5">
                {singleStoreUnassigned.length === 0 ? (
                  <p className="text-xs text-amber-600 italic">All sources assigned ✓</p>
                ) : singleStoreUnassigned.map(s => (
                  <button key={s} onClick={() => addSourceToGroup(s)} disabled={!selectedGroupId}
                    className={`w-full px-3 py-1.5 text-left text-xs rounded-lg border font-medium transition-all ${
                      selectedGroupId
                        ? 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-400 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                    title={selectedGroupId ? 'Click to add to selected group' : 'Select a group first'}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-2">
            {groups.map(group => (
              <GroupCard key={group.id} group={group}
                onSave={saveGroup} onDelete={deleteGroup}
                onSelect={setSelectedGroupId} isSelected={selectedGroupId === group.id}
              />
            ))}
            {showAdd ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3 bg-white">
                <p className="text-sm font-semibold text-gray-700">New Lead Source Group</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} className="text-sm h-8 flex-1 min-w-40" />
                  <div className="flex gap-1">
                    {PARTY_OPTIONS.map(p => (
                      <button key={p} onClick={() => setNewParty(p)}
                        className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${newParty === p
                          ? p === '1st Party' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={addGroup}>Create</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNewName(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setShowAdd(true)}>
                <Plus size={13} /> Add Group
              </Button>
            )}
          </div>
        </div>
      )}


    </div>
  );
}