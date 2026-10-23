import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Play, RefreshCw, Check, Globe, Tag } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM = {
  name: '', active: true,
};

function CompetitorRow({ comp, onSave, onDelete }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: comp.name || comp.competitor_name || '',
    active: comp.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningSpecials, setRunningSpecials] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const update = (field, val) => { setForm(f => ({ ...f, [field]: val })); setDirty(true); };

  const toggleActive = async () => {
    const newActive = !form.active;
    setForm(f => ({ ...f, active: newActive }));
    await onSave(comp.id, { ...form, active: newActive });
    setDirty(false);
  };

  const save = async () => {
    setSaving(true);
    await onSave(comp.id, form);
    setDirty(false);
    setSaving(false);
  };

  const runScraper = async (specialsOnly = false) => {
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
            ? `⚡ Specials-only crawl triggered for ${d.store_name || comp.competitor_name}`
            : `Scraper triggered for ${d.store_name || comp.competitor_name}`
        );
        setTriggered(true);
        setTimeout(() => setTriggered(false), 2000);
        qc.invalidateQueries({ queryKey: ['scraperOperations'] });
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
    <tr className={`border-b border-gray-100 hover:bg-gray-50 group ${form.active ? '' : 'opacity-50'}`}>
      {/* Active toggle */}
      <td className="px-3 py-2 text-center w-10">
        <button
          onClick={toggleActive}
          title={form.active ? 'Active — click to pause' : 'Paused — click to activate'}
          className={`w-3 h-3 rounded-full border-2 transition-colors mx-auto block ${form.active ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}
        />
      </td>
      {/* Name & platform */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Input value={form.name} onChange={e => update('name', e.target.value)}
            className="h-7 text-xs border-transparent group-hover:border-gray-200 bg-transparent focus:bg-white focus:border-gray-300 flex-1" />
          {comp.scraper_platform && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-100 shrink-0">
              {comp.scraper_platform}
            </span>
          )}
          {comp.new_inventory_url && (
            <a href={comp.new_inventory_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500" title={comp.new_inventory_url}>
              <Globe size={12} />
            </a>
          )}
        </div>
      </td>
      {/* Actions */}
      <td className="px-3 py-2 text-right whitespace-nowrap w-44">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2 gap-1 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 border-amber-200"
            onClick={() => runScraper(true)}
            disabled={running || runningSpecials || triggered}
            title="Fetch only specials and offers for this competitor (~5s)"
          >
            {runningSpecials ? <RefreshCw size={10} className="animate-spin text-amber-600" /> : <Tag size={10} />}
            {runningSpecials ? 'Fetching…' : 'Specials Only'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2 gap-1 text-gray-700 hover:bg-blue-50 hover:text-blue-600 border-gray-200"
            onClick={() => runScraper(false)}
            disabled={running || runningSpecials || triggered}
            title="Complete scrape for this competitor"
          >
            {running ? <RefreshCw size={10} className="animate-spin text-blue-600" /> : triggered ? <Check size={10} className="text-green-600" /> : <Play size={10} />}
            {running ? 'Running…' : 'Scrape'}
          </Button>

          {dirty && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:text-green-700" onClick={save} disabled={saving} title="Save">
              <Save size={11} />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-300 hover:text-red-500" onClick={() => onDelete(comp.id)} title="Delete">
            <Trash2 size={11} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function StoreCompetitors({ storeId }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ['storeCompetitors', storeId],
    enabled: !!storeId,
    queryFn: () => base44.entities.StoreCompetitor.filter({ store_id: storeId }, 'sort_order', 50),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['storeCompetitors', storeId] });

  const saveComp = async (id, data) => {
    await base44.entities.StoreCompetitor.update(id, data);
    invalidate();
    toast.success('Competitor saved');
  };

  const deleteComp = async (id) => {
    if (!confirm('Remove this competitor?')) return;
    await base44.entities.StoreCompetitor.delete(id);
    invalidate();
    toast.success('Competitor removed');
  };

  const addComp = async () => {
    if (!newForm.name.trim()) return;
    setSaving(true);
    await base44.entities.StoreCompetitor.create({ store_id: storeId, sort_order: competitors.length, ...newForm });
    invalidate();
    setNewForm(EMPTY_FORM);
    setAdding(false);
    setSaving(false);
    toast.success('Competitor added');
  };

  return (
    <div className="mt-4 border-t border-green-100 pt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Competitors</p>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-x-auto bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 w-10 text-center">
                  <div className="w-3 h-3 rounded-full border-2 border-gray-300 bg-white mx-auto" />
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">Name</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map(c => (
                <CompetitorRow key={c.id} comp={c} onSave={saveComp} onDelete={deleteComp} />
              ))}

              {adding && (
                <tr className="border-b border-blue-100 bg-blue-50/30">
                  <td className="px-3 py-2 text-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-500 mx-auto" />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                      className="h-7 text-xs" placeholder="Competitor name *" autoFocus />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" className="h-6 px-2 bg-slate-900 hover:bg-slate-800 text-xs" onClick={addComp} disabled={saving}>
                        {saving ? '…' : 'Add'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setAdding(false); setNewForm(EMPTY_FORM); }}>
                        ✕
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {competitors.length === 0 && !adding && (
                <tr><td colSpan={3} className="px-3 py-3 text-center text-gray-400 italic text-xs">No competitors added yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!adding && (
        <button onClick={() => setAdding(true)} className="mt-2 flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium">
          <Plus size={12} /> Add Competitor
        </button>
      )}
    </div>
  );
}