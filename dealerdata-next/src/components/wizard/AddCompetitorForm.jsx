import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { slugify, SUPABASE_URL } from './platformPresets';

const REQUIRED = ['store_id', 'name', 'new_inventory_url'];

function req(label) {
  return <>{label} <span className="text-red-500">*</span></>;
}

function inputCls(err) {
  return `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all ${err ? 'border-red-400 bg-red-50' : 'border-gray-200'}`;
}

const BLANK = {
  store_id: '',
  name: '',
  new_inventory_url: '',
  used_inventory_url: '',
  specials_url: '',
  crawl_specials: false,
  scraper_active: true,
};

export default function AddCompetitorForm({ stores }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const errs = {};
    REQUIRED.forEach(k => { if (!form[k]) errs[k] = true; });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) { toast.error('Please fill in all required fields'); return; }
    setSaving(true);
    try {
      const linkedStore = stores.find(s => s.id === form.store_id);
      const slug = slugify(form.name);

      const payload = {
        store_id: form.store_id,
        name: form.name,
        competitor_name: form.name,
        competitor_id: slug,
        competitor_key: slug,
        new_inventory_url: form.new_inventory_url,
        used_inventory_url: form.used_inventory_url || null,
        specials_url: form.specials_url || null,
        crawl_specials: Boolean(form.crawl_specials),
        scraper_platform: 'auto',
        scraper_active: form.scraper_active,
        active: true,
      };

      const comp = await base44.entities.StoreCompetitor.create(payload);

      // Best-effort Supabase sync
      const supabaseRow = {
        scraper_store_id: slug,
        dealer_name: form.name,
        competitor_id: slug,
        dealer_type: 'competitor',
        platform: 'auto',
        new_inventory_url: form.new_inventory_url,
        used_inventory_url: form.used_inventory_url || null,
        specials_url: form.specials_url || null,
        active: true,
      };

      await fetch(`${SUPABASE_URL}/rest/v1/scraper_dealers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
          'apikey': 'use-backend',
        },
        body: JSON.stringify(supabaseRow),
      }).catch(() => {});

      qc.invalidateQueries({ queryKey: ['allCompetitors'] });
      qc.invalidateQueries({ queryKey: ['storeCompetitors', form.store_id] });
      setSaved({ ...comp, storeName: linkedStore?.name });
      toast.success(`Competitor "${comp.name || comp.competitor_name}" created!`);
    } catch (e) {
      toast.error(e?.message || 'Failed to save competitor');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="bg-white border border-green-200 rounded-2xl p-8 text-center space-y-4">
        <CheckCircle size={36} className="text-green-500 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900">"{saved.name || saved.competitor_name}" created!</h3>
        {saved.storeName && <p className="text-sm text-gray-500">Linked to: <strong>{saved.storeName}</strong></p>}
        <p className="text-sm text-gray-500">Competitor ID: <code className="font-mono bg-gray-100 px-1 rounded">{saved.competitor_key || saved.competitor_id}</code></p>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => {
            setSaved(null);
            setForm(f => ({ ...BLANK, store_id: f.store_id }));
            setErrors({});
          }}>Add Another Competitor</Button>
          <Button onClick={() => { setSaved(null); setForm(BLANK); setErrors({}); }}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
      {/* Row 1: Linked Store + Competitor Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{req('Linked Client Store')}</label>
          <select className={inputCls(errors.store_id)} value={form.store_id} onChange={e => set('store_id', e.target.value)}>
            <option value="">Select store…</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{req('Competitor Name')}</label>
          <input className={inputCls(errors.name)} placeholder="Moss Bros CDJR" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
      </div>

      {/* Row 2: Inventory URLs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{req('New Inventory URL')}</label>
          <input className={inputCls(errors.new_inventory_url)} placeholder="https://www.competitor.com/new-inventory/index.htm" value={form.new_inventory_url} onChange={e => set('new_inventory_url', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Used Inventory URL</label>
          <input className={inputCls(false)} placeholder="https://www.competitor.com/used-inventory/index.htm (optional)" value={form.used_inventory_url} onChange={e => set('used_inventory_url', e.target.value)} />
        </div>
      </div>

      {/* Row 3: Specials URL + Crawl Specials Checkbox */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Specials / Offers URL</label>
          <input className={inputCls(false)} placeholder="https://www.competitor.com/specials/ (optional)" value={form.specials_url} onChange={e => set('specials_url', e.target.value)} />
        </div>
        <div className="pt-5 sm:pt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.crawl_specials}
              onChange={e => set('crawl_specials', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700 font-medium">Crawl Specials / Offers</span>
          </label>
          <p className="text-xs text-gray-400 ml-6">Extract competitor offers, incentives, and banner deals.</p>
        </div>
      </div>

      {/* Row 4: Scraper Active toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => set('scraper_active', !form.scraper_active)}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${form.scraper_active ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.scraper_active ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm text-gray-700 font-medium">Scraper Active</span>
        </label>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto px-8">
          {saving ? 'Saving…' : 'Save Competitor'}
        </Button>
      </div>
    </div>
  );
}