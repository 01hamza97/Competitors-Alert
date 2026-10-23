import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/SectionCard';
import { Plus, Trash2, Save, Tag } from 'lucide-react';
import { toast } from 'sonner';

function MappingRow({ mapping, onDelete }) {
  const [form, setForm] = useState({ display_name: mapping.display_name, raw_sources: mapping.raw_sources });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const save = async () => {
    setSaving(true);
    await base44.entities.LeadSourceMapping.update(mapping.id, form);
    qc.invalidateQueries({ queryKey: ['leadSourceMappings'] });
    toast.success('Mapping saved');
    setSaving(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-purple-500" />
          <span className="font-semibold text-gray-700 text-sm">{mapping.display_name}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => onDelete(mapping)}>
          <Trash2 size={13} />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
          <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} className="text-sm h-8" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Raw Source Names <span className="text-gray-400 font-normal">(comma-separated, exact match)</span></label>
          <Input value={form.raw_sources} onChange={e => setForm(f => ({ ...f, raw_sources: e.target.value }))} className="text-sm h-8 font-mono" />
        </div>
      </div>

      {/* Preview chips */}
      <div className="flex flex-wrap gap-1.5">
        {form.raw_sources.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
          <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-100 font-medium">
            {s}
          </span>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={save} disabled={saving}>
          <Save size={11} /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export default function LeadSourceMappings({ groups, selectedGroupId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRaw, setNewRaw] = useState('');
  const qc = useQueryClient();

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['leadSourceMappings'],
    queryFn: () => base44.entities.LeadSourceMapping.list('display_name', 200),
  });

  const addMapping = async () => {
    if (!newName.trim() || !newRaw.trim()) return;
    await base44.entities.LeadSourceMapping.create({
      display_name: newName.trim(),
      raw_sources: newRaw.trim(),
      group_id: selectedGroupId || '',
    });
    qc.invalidateQueries({ queryKey: ['leadSourceMappings'] });
    setNewName(''); setNewRaw(''); setShowAdd(false);
    toast.success('Lead source mapping added');
  };

  const deleteMapping = async (m) => {
    await base44.entities.LeadSourceMapping.delete(m.id);
    qc.invalidateQueries({ queryKey: ['leadSourceMappings'] });
    toast.success('Mapping removed');
  };

  return (
    <SectionCard title="Lead Source Groupings">
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <strong>How it works:</strong> Raw source names from your reports (e.g. "Clickshop 2.0 - Pre-Qual", "Clickshop 2.0 - Declined Prequalified") are combined and displayed as a single group name in the dashboard and emails. Matching is case-insensitive.
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}

        {!isLoading && mappings.length === 0 && !showAdd && (
          <p className="text-gray-400 text-sm py-2">No lead source mappings yet. Add your first grouping below.</p>
        )}

        {mappings.map(m => (
          <MappingRow key={m.id} mapping={m} onDelete={deleteMapping} />
        ))}

        {showAdd ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-white">
            <p className="text-sm font-semibold text-gray-700">New Lead Source Grouping</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
                <Input
                  placeholder="e.g. Clickshop 2.0"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Raw Source Names <span className="text-gray-400">(comma-separated)</span></label>
                <Input
                  placeholder="Clickshop 2.0 - Pre-Qual, Clickshop 2.0 ? Not Pre-Qualified, Clickshop 2.0 - Declined Prequalified"
                  value={newRaw}
                  onChange={e => setNewRaw(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>
            </div>
            {newRaw && (
              <div className="flex flex-wrap gap-1.5">
                {newRaw.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                  <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-100 font-medium">{s}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={addMapping}>Save Mapping</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNewName(''); setNewRaw(''); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 mt-1" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add Lead Source Grouping
          </Button>
        )}
      </div>
    </SectionCard>
  );
}