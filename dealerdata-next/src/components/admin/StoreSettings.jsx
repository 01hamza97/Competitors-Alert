import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SectionCard from '@/components/SectionCard';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function StoreSettings({ store, groups, collapsible = false }) {
  const [open, setOpen] = useState(!collapsible);
  const [form, setForm] = useState({
    name: store.name || '',
    dealership_key: store.dealership_key || '',
    timezone: store.timezone || 'America/Los_Angeles',
  });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    setForm({
      name: store.name || '',
      dealership_key: store.dealership_key || '',
      timezone: store.timezone || 'America/Los_Angeles',
    });
  }, [store.id]);

  const group = groups.find(g => g.id === store.group_id);

  const save = async () => {
    setSaving(true);
    await base44.entities.Store.update(store.id, form);
    qc.invalidateQueries({ queryKey: ['stores'] });
    toast.success('Store settings saved');
    setSaving(false);
  };

  const header = (
    <div
      className={`flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
      onClick={collapsible ? () => setOpen(!open) : undefined}
    >
      <div className="flex items-center gap-2">
        {collapsible && (open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)}
        <span className="font-semibold text-gray-800">{store.name}</span>
        {group && <span className="text-xs text-gray-400">· {group.name}</span>}
      </div>
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="px-5 py-4 border-b border-gray-100">{header}</div>

      {open && (
        <div className="p-5 space-y-5">
          {/* Basic info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Store Info</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Store Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dealership Key <span className="text-gray-400 font-normal">(matches data source)</span></label>
                <Input value={form.dealership_key} onChange={e => setForm(f => ({ ...f, dealership_key: e.target.value }))} placeholder="e.g. Aaron Chevrolet" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
                <Input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="America/Los_Angeles" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 gap-1.5" onClick={save} disabled={saving}>
              <Save size={13} />
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>


        </div>
      )}
    </div>
  );
}