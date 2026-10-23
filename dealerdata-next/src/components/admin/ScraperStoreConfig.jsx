import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Copy, Check, AlertTriangle, Info } from 'lucide-react';
import { PLATFORMS, PLATFORM_RULES, FIELD_LABELS, TOGGLE_FIELDS, getMissingRequiredFields } from './platformRules';

function JsonTextarea({ label, value, onChange, required, recommended }) {
  const [err, setErr] = useState(null);
  const display = value == null ? '' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  function handleChange(e) {
    const raw = e.target.value;
    if (!raw.trim()) { setErr(null); onChange(null); return; }
    try { onChange(JSON.parse(raw)); setErr(null); }
    catch { setErr('Invalid JSON'); onChange(raw); }
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {!required && recommended && <span className="text-amber-500 ml-1 font-normal">(recommended)</span>}
      </label>
      <textarea
        className={`w-full text-xs font-mono border rounded-lg px-3 py-2 resize-y min-h-[60px] focus:outline-none focus:ring-1 ${err ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-300'}`}
        value={display}
        onChange={handleChange}
      />
      {err && <p className="text-xs text-red-500 mt-0.5">{err}</p>}
    </div>
  );
}

function ArrayInput({ label, value, onChange, required, recommended }) {
  const display = Array.isArray(value) ? value.join(', ') : (value || '');
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label} <span className="text-gray-400">(comma-separated)</span>
        {required && <span className="text-red-500 ml-1">*</span>}
        {!required && recommended && <span className="text-amber-500 ml-1 font-normal">(recommended)</span>}
      </label>
      <Input
        className="text-xs"
        value={display}
        onChange={e => {
          const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
          onChange(parts.length > 0 ? parts : null);
        }}
      />
    </div>
  );
}

function FieldInput({ field, form, set, required, recommended }) {
  const label = FIELD_LABELS[field] || field;
  const value = form[field];
  const isToggle = field in TOGGLE_FIELDS;
  const isArray = ['api_inventory_types', 'api_type_slug', 'api_location_values', 'new_price_labels_json', 'used_price_labels_json'].includes(field);
  const isJson = ['api_sort', 'facet_labels_json', 'filter_examples_json', 'dealerinspire_facet_fields', 'extra_config_json'].includes(field);
  const isNumber = ['api_per_page', 'api_limit'].includes(field);

  if (isToggle) {
    return (
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={e => set(field, e.target.checked)} className="rounded" />
        {label}
        {recommended && <span className="text-amber-500">(recommended)</span>}
      </label>
    );
  }
  if (isArray) return <ArrayInput label={label} value={value} onChange={v => set(field, v)} required={required} recommended={recommended} />;
  if (isJson) return <JsonTextarea label={label} value={value} onChange={v => set(field, v)} required={required} recommended={recommended} />;

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {!required && recommended && <span className="text-amber-500 ml-1 font-normal">(recommended)</span>}
      </label>
      <Input
        className="text-xs"
        type={isNumber ? 'number' : 'text'}
        value={value || ''}
        onChange={e => set(field, isNumber ? (e.target.value ? parseInt(e.target.value) : null) : (e.target.value || null))}
      />
    </div>
  );
}

function PlatformRequirementsBox({ platform, form }) {
  const rules = PLATFORM_RULES[platform];
  if (!rules) return null;
  const missing = getMissingRequiredFields(platform, form, 'scraper_store_id');
  return (
    <div className={`rounded-lg border px-4 py-3 text-xs space-y-2 ${missing.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
      <div className="flex items-start gap-2">
        <Info size={13} className={`mt-0.5 shrink-0 ${missing.length > 0 ? 'text-amber-500' : 'text-blue-500'}`} />
        <p className="text-gray-600">{rules.helperText}</p>
      </div>
      {missing.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-amber-700">
            <span className="font-semibold">Missing required fields: </span>
            {missing.join(', ')}
          </p>
        </div>
      )}
      {missing.length === 0 && (
        <p className="text-blue-600 font-medium">✓ All required fields for {rules.label} are filled.</p>
      )}
    </div>
  );
}

export default function ScraperStoreConfig({ store }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...store });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const platform = form.scraper_platform;
  const rules = PLATFORM_RULES[platform] || null;

  // Fields to show in primary area (platform-aware or fallback)
  const primaryFields = rules
    ? rules.primary.filter(f => !['scraper_default_make'].includes(f) || true)
    : ['new_inventory_url', 'used_inventory_url', 'api_url', 'api_key', 'api_per_page', 'new_price_labels_json', 'used_price_labels_json'];

  // Advanced fields: everything NOT in primary, except always-shown core fields
  const coreFields = new Set(['scraper_store_id', 'scraper_platform', 'scraper_default_make']);
  const primarySet = new Set(primaryFields);
  const advancedFields = rules
    ? rules.advanced
    : ['autofi_dealer_id', 'api_limit', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_inventory_types', 'api_type_slug', 'api_location_values', 'api_sort', 'dealerinspire_facet_fields', 'facet_labels_json', 'filter_examples_json'];

  function isRequired(f) { return rules?.required?.includes(f) ?? false; }
  function isRecommended(f) { return rules?.recommended?.includes(f) ?? false; }

  function validate(checkActive = false) {
    if (!form.scraper_store_id?.trim()) {
      toast.error('Scraper Store ID is required');
      return false;
    }
    if (checkActive && platform) {
      const missing = getMissingRequiredFields(platform, form, 'scraper_store_id');
      if (missing.length > 0) {
        toast.error(`Cannot enable scraper: missing ${missing.join(', ')}`);
        return false;
      }
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    // If turning scraper_active on, check required fields
    if (form.scraper_active && !store.scraper_active && platform) {
      const missing = getMissingRequiredFields(platform, form, 'scraper_store_id');
      if (missing.length > 0) {
        toast.warning(`Scraper saved but missing required fields: ${missing.join(', ')}`);
      }
    }
    setSaving(true);
    // All stores scrape daily automatically — scrape_frequency is never user-editable.
    await base44.entities.Store.update(store.id, { ...form, scrape_frequency: 'daily' });
    queryClient.invalidateQueries({ queryKey: ['stores'] });
    queryClient.invalidateQueries({ queryKey: ['allStores'] });
    toast.success('Store scraper config saved');
    setSaving(false);
  }

  function handleScraperActiveChange(checked) {
    if (checked && platform) {
      const missing = getMissingRequiredFields(platform, form, 'scraper_store_id');
      if (missing.length > 0) {
        toast.error(`Cannot enable scraper — missing: ${missing.join(', ')}`);
        return;
      }
    }
    set('scraper_active', checked);
  }

  function copyConfig() {
    const config = {
      scraper_store_id: form.scraper_store_id,
      platform: form.scraper_platform,
      default_make: form.scraper_default_make,
      new_inventory_url: form.new_inventory_url,
      used_inventory_url: form.used_inventory_url,
      api_url: form.api_url,
      api_key: form.api_key,
      api_per_page: form.api_per_page,
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const missingForActive = platform ? getMissingRequiredFields(platform, form, 'scraper_store_id') : [];

  return (
    <div className="space-y-4">
      {/* Always-visible core fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Scraper Store ID <span className="text-red-500">*</span></label>
          <Input className="text-xs" value={form.scraper_store_id || ''} onChange={e => set('scraper_store_id', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Platform <span className="text-red-500">*</span></label>
          <select
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
            value={form.scraper_platform || ''}
            onChange={e => set('scraper_platform', e.target.value || null)}
          >
            <option value="">— none —</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_RULES[p]?.label || p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Default Make
            {isRecommended('scraper_default_make') && <span className="text-amber-500 ml-1 font-normal">(recommended)</span>}
          </label>
          <Input className="text-xs" value={form.scraper_default_make || ''} onChange={e => set('scraper_default_make', e.target.value || null)} />
        </div>
      </div>

      {/* Platform Requirements box */}
      {platform && <PlatformRequirementsBox platform={platform} form={form} />}

      {/* Platform-aware primary fields */}
      <div className="space-y-3">
        {primaryFields.filter(f => !coreFields.has(f) && !(f in TOGGLE_FIELDS)).map(f => (
          <FieldInput key={f} field={f} form={form} set={set} required={isRequired(f)} recommended={isRecommended(f)} />
        ))}
      </div>

      {/* Toggles — platform-filtered */}
      <div className="flex flex-wrap gap-4">
        {/* scraper_active special handling */}
        <label className={`flex items-center gap-2 text-xs cursor-pointer ${missingForActive.length > 0 ? 'text-gray-400' : 'text-gray-600'}`}>
          <input
            type="checkbox"
            checked={!!form.scraper_active}
            onChange={e => handleScraperActiveChange(e.target.checked)}
            className="rounded"
          />
          Scraper Active
          {missingForActive.length > 0 && <span className="text-amber-500 text-xs">(requires required fields)</span>}
        </label>
        {/* Platform-relevant toggles */}
        {Object.entries(TOGGLE_FIELDS)
          .filter(([k]) => !rules || primaryFields.includes(k) || rules.recommended.includes(k))
          .map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} className="rounded" />
              {label}
              {isRecommended(k) && <span className="text-amber-500">(recommended)</span>}
            </label>
          ))
        }
      </div>

      {/* Advanced */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
          onClick={() => setAdvOpen(o => !o)}
        >
          {advOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Advanced Fields
        </button>
        {advOpen && (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['autofi_dealer_id', 'api_limit', 'api_sort_field', 'api_sort_order', 'api_location_field'].map(f => (
                (!primarySet.has(f)) && (
                  <div key={f}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{FIELD_LABELS[f]}</label>
                    <Input
                      className="text-xs"
                      type={f === 'api_limit' ? 'number' : 'text'}
                      value={form[f] || ''}
                      onChange={e => set(f, f === 'api_limit' ? (e.target.value ? parseInt(e.target.value) : null) : (e.target.value || null))}
                    />
                  </div>
                )
              ))}
            </div>
            {['api_inventory_types', 'api_type_slug', 'api_location_values'].filter(f => !primarySet.has(f)).map(f => (
              <ArrayInput key={f} label={FIELD_LABELS[f]} value={form[f]} onChange={v => set(f, v)} />
            ))}
            {!primarySet.has('api_sort') && <JsonTextarea label="API Sort (JSON array)" value={form.api_sort} onChange={v => set('api_sort', v)} />}
            {!primarySet.has('dealerinspire_facet_fields') && <JsonTextarea label="DealerInspire Facet Fields" value={form.dealerinspire_facet_fields} onChange={v => set('dealerinspire_facet_fields', v)} />}
            {!primarySet.has('facet_labels_json') && <JsonTextarea label={FIELD_LABELS.facet_labels_json} value={form.facet_labels_json} onChange={v => set('facet_labels_json', v)} />}
            {!primarySet.has('filter_examples_json') && <JsonTextarea label={FIELD_LABELS.filter_examples_json} value={form.filter_examples_json} onChange={v => set('filter_examples_json', v)} />}
            {/* Toggles not shown in primary */}
            <div className="flex flex-wrap gap-4 pt-1">
              {Object.entries(TOGGLE_FIELDS)
                .filter(([k]) => rules && !primaryFields.includes(k) && !rules.recommended.includes(k))
                .map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} className="rounded" />
                    {label}
                  </label>
                ))
              }
            </div>
            <JsonTextarea label="Raw Advanced JSON (extra_config_json)" value={form.extra_config_json} onChange={v => set('extra_config_json', v)} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={copyConfig}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy Config JSON'}
        </Button>
      </div>
    </div>
  );
}