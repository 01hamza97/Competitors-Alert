import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Sparkles, X, Search } from 'lucide-react';
import { toast } from 'sonner';

const MAKES = ['Ram', 'Jeep', 'Dodge', 'Chrysler', 'Ford', 'Chevrolet', 'Kia', 'Hyundai', 'FIAT', 'Alfa Romeo'];

// ─── Tag Editor ────────────────────────────────────────────────────────────────
function TagEditor({ variants, onChange }) {
  const [input, setInput] = useState('');

  const tags = useMemo(() =>
    variants ? variants.split('|').map(v => v.trim()).filter(Boolean) : [],
    [variants]
  );

  const addTag = (val) => {
    const v = val.trim();
    if (!v || tags.includes(v)) return;
    onChange([...tags, v].join(' | '));
    setInput('');
  };

  const removeTag = (tag) => {
    onChange(tags.filter(t => t !== tag).join(' | '));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1 min-h-[24px]">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-blue-400 hover:text-blue-700 leading-none">
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); } }}
          className="h-6 text-xs flex-1"
          placeholder="Type variant, press Enter…"
        />
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => addTag(input)} tabIndex={-1}>
          <Plus size={10} />
        </Button>
      </div>
    </div>
  );
}

// ─── Single Group Row ────────────────────────────────────────────────────────
function GroupRow({ group, onSave, onDelete }) {
  const [form, setForm] = useState({
    make: group.make || '',
    canonical_model: group.canonical_model || '',
    raw_variants: group.raw_variants || '',
    sort_order: group.sort_order ?? 0,
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (field, val) => { setForm(f => ({ ...f, [field]: val })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    await onSave(group.id, form);
    setDirty(false);
    setSaving(false);
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group align-top">
      <td className="px-3 py-2 w-28">
        <select
          value={form.make}
          onChange={e => update('make', e.target.value)}
          className="w-full text-xs border border-transparent group-hover:border-gray-200 rounded px-1.5 py-1 bg-transparent focus:bg-white focus:border-gray-300 outline-none"
        >
          <option value="">— make —</option>
          {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 w-44">
        <Input
          value={form.canonical_model}
          onChange={e => update('canonical_model', e.target.value)}
          className="h-7 text-xs border-transparent group-hover:border-gray-200 bg-transparent focus:bg-white focus:border-gray-300"
          placeholder="Canonical name"
        />
      </td>
      <td className="px-3 py-2">
        <TagEditor
          variants={form.raw_variants}
          onChange={val => update('raw_variants', val)}
        />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap w-16">
        <div className="flex items-center justify-end gap-1">
          {dirty && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:text-green-700" onClick={save} disabled={saving} title="Save">
              <Save size={11} />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-300 hover:text-red-500" onClick={() => onDelete(group.id)} title="Delete">
            <Trash2 size={11} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Discover Trims Panel ────────────────────────────────────────────────────
function DiscoverPanel({ groups, onClose, onGroupsUpdated }) {
  const [loading, setLoading] = useState(false);
  const [trims, setTrims] = useState(null);
  const [makeFilter, setMakeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [assignments, setAssignments] = useState({}); // trim_key → group id

  const fetchTrims = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('supabaseDiscoverTrims', {});
    setTrims(res.data.trims || []);
    setLoading(false);
  };

  // Build existing mapping: variant string → group id
  const existingMap = useMemo(() => {
    const map = {};
    groups.forEach(g => {
      if (!g.raw_variants) return;
      g.raw_variants.split('|').map(v => v.trim()).filter(Boolean).forEach(v => {
        map[v.toLowerCase()] = g.id;
      });
    });
    return map;
  }, [groups]);

  const trimKey = (t) => `${t.make}||${t.model}||${t.trim}`;

  const unassignedTrims = useMemo(() => {
    if (!trims) return [];
    return trims.filter(t => {
      const alreadyMapped = existingMap[t.trim?.toLowerCase()];
      return !alreadyMapped;
    });
  }, [trims, existingMap]);

  const filteredTrims = useMemo(() => {
    let list = unassignedTrims;
    if (makeFilter !== 'all') list = list.filter(t => t.make === makeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.trim?.toLowerCase().includes(q) || t.model?.toLowerCase().includes(q));
    }
    return list;
  }, [unassignedTrims, makeFilter, search]);

  const distinctMakes = useMemo(() => {
    if (!unassignedTrims) return [];
    return [...new Set(unassignedTrims.map(t => t.make).filter(Boolean))].sort();
  }, [unassignedTrims]);

  const assign = (t, groupId) => {
    setAssignments(a => ({ ...a, [trimKey(t)]: groupId }));
  };

  const saveAssignments = async () => {
    const toSave = Object.entries(assignments).filter(([, gid]) => gid);
    if (toSave.length === 0) { toast.error('No assignments to save.'); return; }

    // Group by target group id
    const byGroup = {};
    toSave.forEach(([key, gid]) => { if (!byGroup[gid]) byGroup[gid] = []; byGroup[gid].push(key); });

    for (const [gid, keys] of Object.entries(byGroup)) {
      const group = groups.find(g => g.id === gid);
      if (!group) continue;
      const existing = group.raw_variants
        ? group.raw_variants.split('|').map(v => v.trim()).filter(Boolean)
        : [];
      const newVariants = keys.map(k => k.split('||')[2]); // extract trim from key
      const merged = [...new Set([...existing, ...newVariants])].join(' | ');
      await base44.entities.VehicleModelGroup.update(gid, { raw_variants: merged });
    }

    toast.success(`Saved ${toSave.length} trim assignment${toSave.length !== 1 ? 's' : ''}`);
    onGroupsUpdated();
    onClose();
  };

  const assignedCount = Object.values(assignments).filter(Boolean).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">Discover Trims from Supabase</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X size={13} /></Button>
      </div>

      <div className="p-4 space-y-4">
        {!trims ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500 mb-3">Fetch all distinct trims from <code className="bg-gray-100 px-1 rounded">competitor_inventory_pricing</code> that aren't yet mapped to any group.</p>
            <Button onClick={fetchTrims} disabled={loading} className="bg-slate-900 hover:bg-slate-800 gap-1.5">
              {loading ? 'Fetching…' : <><Sparkles size={13} /> Fetch Unassigned Trims</>}
            </Button>
          </div>
        ) : unassignedTrims.length === 0 ? (
          <p className="text-center text-sm text-green-600 py-6">All trims are already assigned to groups!</p>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={makeFilter}
                onChange={e => setMakeFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="all">All Makes ({unassignedTrims.length} unassigned)</option>
                {distinctMakes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="relative flex-1 min-w-[160px]">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pl-6" placeholder="Search trim or model…" />
              </div>
              {assignedCount > 0 && (
                <Button size="sm" className="ml-auto bg-green-600 hover:bg-green-700 gap-1.5" onClick={saveAssignments}>
                  <Save size={12} /> Save {assignedCount} Assignment{assignedCount !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            {/* Trim list */}
            <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500 w-24">Make</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500 w-36">Model</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Trim</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500 w-52">Assign to Group</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrims.map(t => {
                    const key = trimKey(t);
                    const assignedGid = assignments[key] || '';
                    const compatibleGroups = groups.filter(g => g.make === t.make);
                    return (
                      <tr key={key} className={`border-b border-gray-50 ${assignedGid ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-1.5 text-gray-600">{t.make}</td>
                        <td className="px-3 py-1.5 text-gray-600">{t.model}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-800">{t.trim}</td>
                        <td className="px-3 py-1.5">
                          <select
                            value={assignedGid}
                            onChange={e => assign(t, e.target.value)}
                            className={`w-full text-xs border rounded px-1.5 py-1 focus:outline-none ${assignedGid ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700'}`}
                          >
                            <option value="">— unassigned —</option>
                            {compatibleGroups.length > 0
                              ? compatibleGroups.map(g => <option key={g.id} value={g.id}>{g.canonical_model}</option>)
                              : groups.map(g => <option key={g.id} value={g.id}>{g.make} / {g.canonical_model}</option>)
                            }
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {assignedCount > 0 && (
              <div className="flex justify-end">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={saveAssignments}>
                  <Save size={12} /> Save {assignedCount} Assignment{assignedCount !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
const EMPTY = { make: '', canonical_model: '', raw_variants: '', sort_order: 0 };

export default function VehicleModelGroups() {
  const qc = useQueryClient();
  const [makeFilter, setMakeFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [expandedMakes, setExpandedMakes] = useState({});
  const [showDiscover, setShowDiscover] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['vehicleModelGroups'],
    queryFn: () => base44.entities.VehicleModelGroup.list('make', 500),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vehicleModelGroups'] });

  const saveGroup = async (id, data) => {
    await base44.entities.VehicleModelGroup.update(id, data);
    invalidate();
    toast.success('Saved');
  };

  const deleteGroup = async (id) => {
    if (!confirm('Remove this model group?')) return;
    await base44.entities.VehicleModelGroup.delete(id);
    invalidate();
    toast.success('Removed');
  };

  const addGroup = async () => {
    if (!newForm.make || !newForm.canonical_model.trim()) {
      toast.error('Make and canonical model are required.');
      return;
    }
    setSaving(true);
    await base44.entities.VehicleModelGroup.create({ ...newForm, sort_order: groups.length });
    invalidate();
    setNewForm(EMPTY);
    setAdding(false);
    setSaving(false);
    toast.success('Model group added');
  };

  const byMake = useMemo(() => {
    const map = {};
    groups.forEach(g => {
      const mk = g.make || '(no make)';
      if (!map[mk]) map[mk] = [];
      map[mk].push(g);
    });
    return map;
  }, [groups]);

  const makes = Object.keys(byMake).sort();
  const filteredMakes = makeFilter === 'all' ? makes : makes.filter(m => m === makeFilter);
  const toggleMake = (mk) => setExpandedMakes(prev => ({ ...prev, [mk]: !prev[mk] }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Vehicle Model Groups</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Define canonical model names and map raw variants from different scrapers/dealerships into a single group for consistent display.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={makeFilter}
          onChange={e => setMakeFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
        >
          <option value="all">All Makes</option>
          {makes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setShowDiscover(v => !v)}>
            <Sparkles size={13} /> Discover Trims
          </Button>
          <Button size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800" onClick={() => setAdding(true)}>
            <Plus size={13} /> Add Model Group
          </Button>
        </div>
      </div>

      {/* Discover panel */}
      {showDiscover && (
        <DiscoverPanel
          groups={groups}
          onClose={() => setShowDiscover(false)}
          onGroupsUpdated={invalidate}
        />
      )}

      {/* Add row */}
      {adding && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700">New Model Group</p>
          <div className="flex flex-wrap gap-3">
            <select
              value={newForm.make}
              onChange={e => setNewForm(f => ({ ...f, make: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-32 focus:outline-none"
            >
              <option value="">— Make —</option>
              {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <Input
              value={newForm.canonical_model}
              onChange={e => setNewForm(f => ({ ...f, canonical_model: e.target.value }))}
              className="h-8 text-xs w-48"
              placeholder="Canonical model *"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={addGroup} disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewForm(EMPTY); }}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-400 py-4">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">No model groups defined yet.</p>
          <p className="text-gray-300 text-xs mt-1">Add groups above, or use "Discover Trims" to pull directly from Supabase.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMakes.map(mk => {
            const isOpen = expandedMakes[mk] !== false;
            const mkGroups = byMake[mk] || [];
            return (
              <div key={mk} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => toggleMake(mk)}
                >
                  {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  <span className="text-sm font-bold text-gray-800">{mk}</span>
                  <span className="text-xs text-gray-400 ml-1">{mkGroups.length} model{mkGroups.length !== 1 ? 's' : ''}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 w-28">Make</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 w-44">Canonical Model</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Variants (tags)</th>
                          <th className="w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {mkGroups.map(g => (
                          <GroupRow key={g.id} group={g} onSave={saveGroup} onDelete={deleteGroup} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}