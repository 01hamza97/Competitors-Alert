import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { PLATFORMS, PLATFORM_RULES } from './platformRules';

export default function AddCompetitorModal({ store, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    competitor_id: '',
    scraper_platform: '',
    scraper_default_make: '',
    active: true,
    scraper_active: false,
    new_inventory_url: '',
    used_inventory_url: '',
    api_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Competitor name is required';
    if (!form.competitor_id.trim()) e.competitor_id = 'Competitor ID is required';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    const payload = { store_id: store.id };
    for (const [k, v] of Object.entries(form)) {
      if (v !== '' && v !== null && v !== undefined) payload[k] = v;
    }
    await base44.entities.StoreCompetitor.create(payload);
    queryClient.invalidateQueries({ queryKey: ['storeCompetitors', store.id] });
    toast.success('Competitor added');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Add Competitor</h2>
            <p className="text-xs text-gray-400 mt-0.5">Under: {store.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Competitor Name <span className="text-red-500">*</span></label>
              <Input className="text-xs" placeholder="e.g. Moss Bros CDJR" value={form.name} onChange={e => set('name', e.target.value)} />
              {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Competitor ID <span className="text-red-500">*</span></label>
              <Input className="text-xs font-mono" placeholder="e.g. moss_bros_cdjr" value={form.competitor_id} onChange={e => set('competitor_id', e.target.value)} />
              {errors.competitor_id && <p className="text-xs text-red-500 mt-0.5">{errors.competitor_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Platform</label>
              <select className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                value={form.scraper_platform} onChange={e => set('scraper_platform', e.target.value)}>
                <option value="">— none —</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_RULES[p]?.label || p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Default Make</label>
              <Input className="text-xs" value={form.scraper_default_make} onChange={e => set('scraper_default_make', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">New Inventory URL</label>
              <Input className="text-xs" value={form.new_inventory_url} onChange={e => set('new_inventory_url', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Used Inventory URL</label>
              <Input className="text-xs" value={form.used_inventory_url} onChange={e => set('used_inventory_url', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">API URL</label>
              <Input className="text-xs" value={form.api_url} onChange={e => set('api_url', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!!form.scraper_active} onChange={e => set('scraper_active', e.target.checked)} className="rounded" />
              Scraper Active
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked)} className="rounded" />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Adding…' : 'Add Competitor'}</Button>
        </div>
      </div>
    </div>
  );
}