import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronRight, Building2, Play, Trash2, Save, Check, RefreshCw, Tag, Layers,
} from 'lucide-react';
import { SUPABASE_URL, slugify } from '@/components/wizard/platformPresets';

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific (PT)', utc: '17:00', disp: '10:00am PT' },
  { value: 'America/Denver', label: 'Mountain (MT)', utc: '16:00', disp: '10:00am MT' },
  { value: 'America/Chicago', label: 'Central (CT)', utc: '15:00', disp: '10:00am CT' },
  { value: 'America/New_York', label: 'Eastern (ET)', utc: '14:00', disp: '10:00am ET' },
];

// ---- Competitor sub-row (inline expand to edit + delete) ----
function CompetitorSubRow({ comp, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningSpecials, setRunningSpecials] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [form, setForm] = useState({ ...comp });
  useEffect(() => {
    setForm({ ...comp });
  }, [comp]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const slug = form.competitor_key || form.competitor_id || slugify(form.name);
      const payload = {
        ...form,
        competitor_name: form.name,
        competitor_key: slug,
        competitor_id: slug,
        specials_url: form.specials_url || null,
        crawl_specials: Boolean(form.crawl_specials),
        scraper_platform: 'auto',
      };
      await base44.entities.StoreCompetitor.update(comp.id, payload);
      toast.success('Competitor saved');
      onSaved?.();
    } catch (e) {
      toast.error(e?.message || 'Failed to save competitor');
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const del = async () => {
    if (!confirm(`Delete competitor "${comp.name}"?`)) return;
    await base44.entities.StoreCompetitor.delete(comp.id);
    toast.success('Competitor removed');
    onDeleted?.(comp.id);
  };

  const runScrape = async (specialsOnly = false) => {
    if (specialsOnly) setRunningSpecials(true);
    else setRunning(true);
    try {
      const res = await base44.functions.invoke('triggerScraper', {
        scope: 'competitor',
        competitor_id: comp.id,
        specials_only: specialsOnly,
        source: 'ui_button',
        clicked_at: new Date().toISOString(),
      });
      const d = res.data;
      if (d?.ok) {
        toast.success(
          specialsOnly
            ? `⚡ Specials-only crawl triggered for ${d.store_name || comp.name}`
            : `Full scrape triggered for ${d.store_name || comp.name}`
        );
        setTriggered(true);
        setTimeout(() => setTriggered(false), 2000);
      } else {
        toast.error(d?.error || 'Failed to trigger competitor scraper');
      }
    } catch (e) {
      toast.error(`Trigger failed: ${e?.message}`);
    } finally {
      setRunning(false);
      setRunningSpecials(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 text-left min-w-0">
          {open ? <ChevronDown size={12} className="text-gray-400 shrink-0" /> : <ChevronRight size={12} className="text-gray-400 shrink-0" />}
          <span className="text-sm text-gray-700 font-medium truncate">{comp.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-100 shrink-0">Competitor</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 gap-1 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 border-amber-200"
            onClick={(e) => { e.stopPropagation(); runScrape(true); }}
            disabled={running || runningSpecials || triggered}
            title="Fetch only specials and offers for this competitor (~5s)"
          >
            {runningSpecials ? <RefreshCw size={9} className="animate-spin text-amber-600" /> : <Tag size={9} />}
            {runningSpecials ? 'Fetching…' : 'Specials Only'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 border-blue-200"
            onClick={(e) => { e.stopPropagation(); runScrape(false); }}
            disabled={running || runningSpecials || triggered}
            title="Complete scrape for this competitor"
          >
            {running ? <RefreshCw size={9} className="animate-spin text-blue-600" /> : <Play size={9} />}
            {running ? 'Scraping…' : 'Scrape'}
          </Button>

          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 hover:text-red-500 shrink-0" onClick={del} title="Delete competitor">
            <Trash2 size={11} />
          </Button>
        </div>
      </div>
      {open && (
        <div className="p-3 space-y-3 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Competitor Name</label>
              <Input className="text-xs h-8" value={form.name || ''} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">New Inventory URL</label>
              <Input className="text-xs h-8" value={form.new_inventory_url || ''} onChange={e => set('new_inventory_url', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Used Inventory URL</label>
              <Input className="text-xs h-8" placeholder="https://… (optional)" value={form.used_inventory_url || ''} onChange={e => set('used_inventory_url', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Specials / Offers URL</label>
              <Input className="text-xs h-8" placeholder="https://… (optional)" value={form.specials_url || ''} onChange={e => set('specials_url', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.crawl_specials} onChange={e => set('crawl_specials', e.target.checked)} className="rounded" />
              Crawl Specials / Offers
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.scraper_active} onChange={e => set('scraper_active', e.target.checked)} className="rounded" />
              Scraper Active
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={form.active !== false} onChange={e => set('active', e.target.checked)} className="rounded" />
              Active
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving}><Save size={12} className="mr-1" /> {saving ? 'Saving…' : 'Save'}</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Competitors sub-list for a store ----
function StoreCompetitorsSublist({ store }) {
  const qc = useQueryClient();
  const [competitors, setCompetitors] = useState([]);

  const { data: list, isLoading } = useQuery({
    queryKey: ['storeCompetitors', store.id],
    enabled: !!store.id,
    queryFn: () => base44.entities.StoreCompetitor.filter({ store_id: store.id }, 'name', 200),
  });

  useEffect(() => { if (list) setCompetitors(list); }, [list]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['storeCompetitors', store.id] });
  const onDeleted = (id) => setCompetitors(prev => prev.filter(c => c.id !== id));

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Competitors ({competitors.length})</p>
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : competitors.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">No competitors added yet. Use "+ Add Competitor" at the top linked to this store.</p>
      ) : (
        <div className="space-y-2">
          {competitors.map(c => <CompetitorSubRow key={c.id} comp={c} onSaved={refresh} onDeleted={onDeleted} />)}
        </div>
      )}
    </div>
  );
}

// ---- Main expanded store row ----
export default function UnifiedStoreRow({ store }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [form, setForm] = useState({ ...store });
  useEffect(() => {
    setForm({ ...store });
  }, [store]);
  const qc = useQueryClient();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const tzMeta = TIMEZONES.find(t => t.value === (form.timezone || 'America/Los_Angeles')) || TIMEZONES[0];

  const handleTzChange = (tz) => {
    const meta = TIMEZONES.find(t => t.value === tz) || TIMEZONES[0];
    setForm(f => ({ ...f, timezone: tz, scheduled_scrape_utc: meta.utc }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const scheduled = tzMeta.utc;
      const slug = form.dealership_key || form.scraper_store_id || slugify(form.name);
      const payload = {
        ...form,
        dealership_key: slug,
        scraper_store_id: slug,
        scraper_platform: 'auto',
        specials_url: form.specials_url || null,
        crawl_specials: Boolean(form.crawl_specials),
        scrape_frequency: 'daily',
        scheduled_scrape_utc: scheduled,
      };
      await base44.entities.Store.update(store.id, payload);

      // Best-effort upsert to Supabase scraper_store_schedule
      await fetch(`${SUPABASE_URL}/rest/v1/scraper_store_schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates', 'apikey': 'use-backend' },
        body: JSON.stringify({
          scraper_store_id: slug,
          scheduled_scrape_utc: scheduled,
          scraper_active: !!form.scraper_active,
          active: true,
        }),
      }).catch(() => {});

      qc.invalidateQueries({ queryKey: ['stores'] });
      qc.invalidateQueries({ queryKey: ['allStores'] });
      toast.success('Store config saved');
    } catch (e) {
      toast.error(e?.message || 'Failed to save store');
    } finally {
      setSaving(false);
    }
  };

  const [runningMode, setRunningMode] = useState(null); // 'specials' | 'single' | 'all' | null

  const runNow = async ({ specialsOnly = false, includeCompetitors = false } = {}) => {
    const sid = store.scraper_store_id || store.dealership_key || store.id;
    if (!sid) {
      toast.error(`"${form.name}" has no Store ID set`);
      return;
    }
    const modeKey = specialsOnly ? 'specials' : (includeCompetitors ? 'all' : 'single');
    setRunningMode(modeKey);
    try {
      const res = await base44.functions.invoke('triggerScraper', {
        scope: 'store',
        store_id: sid,
        specials_only: specialsOnly,
        include_competitors: includeCompetitors,
        source: 'ui_button',
        clicked_at: new Date().toISOString(),
      });
      const d = res.data;
      if (d?.ok) {
        if (specialsOnly) {
          toast.success(`⚡ Specials-only crawl triggered for ${d.store_name || form.name}`);
        } else if (includeCompetitors) {
          const compText = d.competitor_count > 0 ? ` (+${d.competitor_count} competitors queued)` : '';
          toast.success(`Full scrape triggered for ${d.store_name || form.name}${compText}`);
        } else {
          toast.success(`Individual scrape triggered for ${d.store_name || form.name} (competitors skipped)`);
        }
        setTriggered(true);
        setTimeout(() => setTriggered(false), 2000);
        qc.invalidateQueries({ queryKey: ['scraperInventoryHealth'] });
      } else {
        const detail = d?.detail ? `GitHub ${d.github_status}: ${d.detail}` : (d?.error || 'Failed to trigger run');
        toast.error(detail);
      }
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.response?.data?.error || e?.message;
      toast.error(`Trigger failed: ${detail}`);
    } finally {
      setRunningMode(null);
    }
  };

  const del = async () => {
    if (!confirm(`Delete store "${store.name}"? This will also remove all competitors assigned to this store.`)) return;
    await base44.entities.Store.delete(store.id);
    qc.invalidateQueries({ queryKey: ['stores'] });
    qc.invalidateQueries({ queryKey: ['allStores'] });
    qc.invalidateQueries({ queryKey: ['allCompetitors'] });
    toast.success('Store and associated competitors removed');
  };

  const isBusy = Boolean(runningMode);

  return (
    <div className="border-b border-gray-100">
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 flex-wrap sm:flex-nowrap">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 text-left min-w-0">
          {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
          <Building2 size={14} className="text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-800 text-sm truncate">{store.name}</span>
          <span className="text-[11px] text-gray-400 shrink-0 hidden md:block">{store.timezone || '—'}</span>
          <span className="text-[11px] text-gray-400 shrink-0 hidden lg:block">{tzMeta.disp}</span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <div
            onClick={() => set('scraper_active', !form.scraper_active)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer mr-1 ${form.scraper_active ? 'bg-green-500' : 'bg-gray-300'}`}
            title={form.scraper_active ? 'Scraper active' : 'Scraper paused'}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-all ${form.scraper_active ? 'left-5' : 'left-1'}`} />
          </div>

          {/* 1. Specials Only button */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 border-amber-200 font-medium"
            onClick={(e) => { e.stopPropagation(); runNow({ specialsOnly: true, includeCompetitors: false }); }}
            disabled={isBusy || triggered}
            title="Fast crawl: fetch only specials and offers for this store (~5-10s)"
          >
            {runningMode === 'specials' ? <RefreshCw size={11} className="animate-spin text-amber-600" /> : <Tag size={11} />}
            {runningMode === 'specials' ? 'Fetching…' : 'Specials Only'}
          </Button>

          {/* 2. Scrape Store Only button */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 border-blue-200 font-medium"
            onClick={(e) => { e.stopPropagation(); runNow({ specialsOnly: false, includeCompetitors: false }); }}
            disabled={isBusy || triggered}
            title="Complete scrape for this individual store only (skips competitors)"
          >
            {runningMode === 'single' ? <RefreshCw size={11} className="animate-spin text-blue-600" /> : <Play size={11} />}
            {runningMode === 'single' ? 'Scraping Store…' : 'Scrape Store'}
          </Button>

          {/* 3. Scrape All (+Competitors) button */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-gray-700 hover:bg-gray-100 border-gray-200 font-medium"
            onClick={(e) => { e.stopPropagation(); runNow({ specialsOnly: false, includeCompetitors: true }); }}
            disabled={isBusy || triggered}
            title="Scrape this store and cascade to all its active competitors"
          >
            {runningMode === 'all' ? <RefreshCw size={11} className="animate-spin text-gray-600" /> : triggered ? <Check size={11} className="text-green-600" /> : <Layers size={11} />}
            {runningMode === 'all' ? 'Queuing All…' : triggered ? 'Triggered!' : 'All (+Comps)'}
          </Button>
        </div>
      </div>

      {/* Expanded editor */}
      {open && (
        <div className="px-6 pb-5 bg-gray-50/50 border-t border-gray-100">
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Store Name"><Input className="text-sm h-8" value={form.name || ''} onChange={e => set('name', e.target.value)} /></Field>
              <Field label="Timezone">
                <select className="w-full h-8 border border-gray-200 rounded-md px-2 text-sm bg-white" value={form.timezone || 'America/Los_Angeles'} onChange={e => handleTzChange(e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.value} — {tz.label} ({tz.disp})</option>)}
                </select>
              </Field>
              <Field label="New Inventory URL"><Input className="text-sm h-8" value={form.new_inventory_url || ''} onChange={e => set('new_inventory_url', e.target.value)} /></Field>
              <Field label="Used Inventory URL"><Input className="text-sm h-8" placeholder="https://… (optional)" value={form.used_inventory_url || ''} onChange={e => set('used_inventory_url', e.target.value)} /></Field>
              <Field label="Specials / Offers URL"><Input className="text-sm h-8" placeholder="https://… (optional)" value={form.specials_url || ''} onChange={e => set('specials_url', e.target.value)} /></Field>
              <Field label="GM Name"><Input className="text-sm h-8" placeholder="Optional" value={form.gm_name || ''} onChange={e => set('gm_name', e.target.value)} /></Field>
              <Field label="GM Email(s)"><Input className="text-sm h-8" placeholder="email@example.com (optional)" value={form.gm_emails || ''} onChange={e => set('gm_emails', e.target.value)} /></Field>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={!!form.crawl_specials} onChange={e => set('crawl_specials', e.target.checked)} className="rounded" /> Crawl Specials / Offers
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={!!form.scraper_active} onChange={e => set('scraper_active', e.target.checked)} className="rounded" /> Scraper Active
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={form.active !== false} onChange={e => set('active', e.target.checked)} className="rounded" /> Store Active
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={save} disabled={saving}><Save size={12} className="mr-1" /> {saving ? 'Saving…' : 'Save'}</Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 ml-auto" onClick={del}><Trash2 size={12} className="mr-1" /> Delete Store</Button>
            </div>

            <StoreCompetitorsSublist store={store} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}