import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { slugify, SUPABASE_URL } from './platformPresets';

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
];

const TZ_TO_SCRAPE_UTC = {
  'America/Los_Angeles': '17:00',
  'America/Denver': '16:00',
  'America/Chicago': '15:00',
  'America/New_York': '14:00',
};

const REQUIRED = ['group_id', 'name', 'new_inventory_url'];

function req(label) {
  return <>{label} <span className="text-red-500">*</span></>;
}

function inputCls(err) {
  return `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all ${err ? 'border-red-400 bg-red-50' : 'border-gray-200'}`;
}

const BLANK = {
  group_id: '',
  name: '',
  timezone: 'America/Los_Angeles',
  new_inventory_url: '',
  used_inventory_url: '',
  specials_url: '',
  crawl_specials: false,
  gm_name: '',
  gm_emails: '',
  scraper_active: true,
};

export default function AddClientStoreForm({ onSwitchToCompetitor }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const { data: groups = [], refetch: refetchGroups } = useQuery({
    queryKey: ['dealerGroups'],
    queryFn: () => base44.entities.DealerGroup.list('name', 100),
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const g = await base44.entities.DealerGroup.create({ name: newGroupName.trim() });
      await refetchGroups();
      set('group_id', g.id);
      setNewGroupName('');
      setShowNewGroup(false);
      toast.success(`Group "${g.name}" created`);
    } catch (e) {
      toast.error('Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

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
      const slug = slugify(form.name);
      const storePayload = {
        group_id: form.group_id,
        name: form.name,
        dealership_key: slug,
        scraper_store_id: slug,
        timezone: form.timezone,
        new_inventory_url: form.new_inventory_url,
        used_inventory_url: form.used_inventory_url || null,
        specials_url: form.specials_url || null,
        crawl_specials: Boolean(form.crawl_specials),
        scraper_platform: 'auto',
        gm_name: form.gm_name || null,
        gm_emails: form.gm_emails || null,
        scrape_frequency: 'daily',
        scraper_active: form.scraper_active,
        scheduled_scrape_utc: TZ_TO_SCRAPE_UTC[form.timezone] || '17:00',
        active: true,
      };

      const store = await base44.entities.Store.create(storePayload);

      // Best-effort Supabase sync
      const supabaseRow = {
        scraper_store_id: slug,
        dealer_name: form.name,
        competitor_id: slug,
        dealer_type: 'client',
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

      qc.invalidateQueries({ queryKey: ['allStores'] });
      qc.invalidateQueries({ queryKey: ['stores'] });
      setSaved(store);
      toast.success(`Store "${store.name}" created!`);
    } catch (e) {
      toast.error(e?.message || 'Failed to save store');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="bg-white border border-green-200 rounded-2xl p-8 text-center space-y-4">
        <CheckCircle size={36} className="text-green-500 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900">"{saved.name}" created!</h3>
        <p className="text-sm text-gray-500">Store ID: <code className="font-mono bg-gray-100 px-1 rounded">{saved.scraper_store_id || saved.dealership_key}</code></p>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => { setSaved(null); setForm(BLANK); setErrors({}); }}>Add Another Store</Button>
          <Button onClick={onSwitchToCompetitor}>Add Competitors for This Store</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
      {/* Row 1: Dealer Group + Store Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{req('Dealer Group')}</label>
          {!showNewGroup ? (
            <div className="flex gap-2">
              <select
                className={inputCls(errors.group_id)}
                value={form.group_id}
                onChange={e => set('group_id', e.target.value)}
              >
                <option value="">Select group…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="button" onClick={() => setShowNewGroup(true)} className="shrink-0 flex items-center gap-1 text-xs text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50">
                <Plus size={12} /> New
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className={inputCls(false)}
                placeholder="New group name"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createGroup(); }}
                autoFocus
              />
              <Button size="sm" onClick={createGroup} disabled={creatingGroup}>{creatingGroup ? '…' : 'Save'}</Button>
              <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setShowNewGroup(false)}>Cancel</button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{req('Store Name')}</label>
          <input className={inputCls(errors.name)} placeholder="Aaron Ford Escondido" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
      </div>

      {/* Row 2: Inventory URLs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{req('New Inventory URL')}</label>
          <input className={inputCls(errors.new_inventory_url)} placeholder="https://www.example.com/new-vehicles/" value={form.new_inventory_url} onChange={e => set('new_inventory_url', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Used Inventory URL</label>
          <input className={inputCls(false)} placeholder="https://www.example.com/used-vehicles/ (optional)" value={form.used_inventory_url} onChange={e => set('used_inventory_url', e.target.value)} />
        </div>
      </div>

      {/* Row 3: Specials URL + Crawl Specials Checkbox */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Specials / Offers URL</label>
          <input className={inputCls(false)} placeholder="https://www.example.com/specials/ (optional)" value={form.specials_url} onChange={e => set('specials_url', e.target.value)} />
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
          <p className="text-xs text-gray-400 ml-6">Extract promotions, discounts, and banner offers.</p>
        </div>
      </div>

      {/* Row 4: Timezone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Timezone</label>
          <select className={inputCls(false)} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.value} — {tz.label}</option>)}
          </select>
        </div>
      </div>

      {/* Row 5: GM Info (Optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">GM Name</label>
          <input className={inputCls(false)} placeholder="Optional" value={form.gm_name} onChange={e => set('gm_name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">GM Email(s)</label>
          <input className={inputCls(false)} placeholder="email@example.com, email2@… (optional)" value={form.gm_emails} onChange={e => set('gm_emails', e.target.value)} />
        </div>
      </div>

      {/* Row 6: Scraper Active toggle */}
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
          {saving ? 'Saving…' : 'Save Client Store'}
        </Button>
      </div>
    </div>
  );
}