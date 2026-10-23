import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, ChevronDown, ChevronRight, AlertTriangle, Plus, RefreshCw, Info } from 'lucide-react';

// Fields dealers.json uses that map to Base44 entity fields
const KNOWN_SCHEMA_FIELDS = new Set([
  'dealer_name', 'competitor_id', 'dealer_type', 'platform',
  'new_price_labels', 'used_price_labels', 'new_inventory_url', 'used_inventory_url',
  'facet_labels', 'filter_examples', 'active',
  'api_url', 'api_key', 'api_per_page', 'api_limit',
  'api_type_slug', 'api_inventory_types', 'api_sort_field', 'api_sort_order',
  'api_sort', 'api_location_field', 'api_location_values',
  'dealerinspire_facet_fields', 'autofi_dealer_id',
  'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback',
  'skip_make_param',
]);

// Map dealers.json dealer fields to Base44 StoreCompetitor/Store entity fields
function mapDealerToEntity(d) {
  const extra = {};
  // Capture unknown fields into extra
  for (const [k, v] of Object.entries(d)) {
    if (!KNOWN_SCHEMA_FIELDS.has(k)) {
      extra[k] = v;
    }
  }

  return {
    name: d.dealer_name,
    competitor_id: d.competitor_id || null,
    scraper_platform: d.platform || null,
    active: d.active !== false,
    scraper_active: d.active !== false,
    new_inventory_url: d.new_inventory_url || null,
    used_inventory_url: d.used_inventory_url || null,
    new_price_labels_json: d.new_price_labels || null,
    used_price_labels_json: d.used_price_labels || null,
    facet_labels_json: d.facet_labels || null,
    filter_examples_json: d.filter_examples || null,
    api_url: d.api_url || null,
    api_key: d.api_key || null,
    api_per_page: d.api_per_page || null,
    api_limit: d.api_limit || null,
    api_type_slug: d.api_type_slug || null,
    api_inventory_types: d.api_inventory_types || null,
    api_sort_field: d.api_sort_field || null,
    api_sort_order: d.api_sort_order || null,
    api_sort: d.api_sort || null,
    api_location_field: d.api_location_field || null,
    api_location_values: d.api_location_values || null,
    dealerinspire_facet_fields: d.dealerinspire_facet_fields || null,
    autofi_dealer_id: d.autofi_dealer_id || null,
    use_autofi_page_price_override: d.use_autofi_page_price_override || null,
    use_autofi_missing_vin_page_fallback: d.use_autofi_missing_vin_page_fallback || null,
    skip_make_param: d.skip_make_param || null,
    extra_config_json: Object.keys(extra).length > 0 ? extra : null,
  };
}

// Compute diff: only fields that will actually change (non-null incoming value vs current)
function computeDiff(incoming, current) {
  const changes = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null || v === undefined) continue; // don't overwrite with null
    const curVal = current[k];
    const inStr = JSON.stringify(v);
    const curStr = JSON.stringify(curVal);
    if (inStr !== curStr) {
      changes[k] = { from: curVal, to: v };
    }
  }
  return changes;
}

function DiffRow({ field, from, to }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs py-0.5 border-b border-gray-50 last:border-0">
      <span className="font-mono text-gray-500 truncate">{field}</span>
      <span className="text-red-500 truncate">{JSON.stringify(from)}</span>
      <span className="text-green-600 truncate">{JSON.stringify(to)}</span>
    </div>
  );
}

const STORE_MATCH_BADGE = {
  scraper_store_id: { label: 'matched: scraper_store_id', cls: 'bg-blue-100 text-blue-700' },
  dealership_key:   { label: 'matched: dealership_key',   cls: 'bg-cyan-100 text-cyan-700' },
  dealer_id:        { label: 'matched: dealer_id',         cls: 'bg-indigo-100 text-indigo-700' },
  name:             { label: 'matched: name ⚠',            cls: 'bg-amber-100 text-amber-700' },
  none:             { label: 'no match → NEW',              cls: 'bg-green-100 text-green-700' },
};

function StorePreviewRow({ storeEntry, existing }) {
  const [open, setOpen] = useState(false);
  const isNew = !existing;
  const diff = isNew ? {} : computeDiff(storeEntry.storeFields, existing);
  // Never show group_id as a pending diff (it's protected)
  delete diff.group_id;
  const hasDiff = Object.keys(diff).length > 0;
  const matchBadge = STORE_MATCH_BADGE[storeEntry.storeMatchMethod] || STORE_MATCH_BADGE.none;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 text-left"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
        <span className="font-semibold text-sm text-gray-800 flex-1">{storeEntry.store_name}</span>
        <span className="text-xs font-mono text-gray-400 mr-1" title="dealerKey used for matching">{storeEntry.dealerKey}</span>
        <Badge className={`text-xs mr-1 ${matchBadge.cls}`}>{matchBadge.label}</Badge>
        {isNew
          ? <Badge className="bg-green-100 text-green-700 text-xs">New Store</Badge>
          : hasDiff
            ? <Badge className="bg-amber-100 text-amber-700 text-xs">{Object.keys(diff).length} field(s) will update</Badge>
            : <Badge className="bg-gray-100 text-gray-500 text-xs">No changes</Badge>
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 bg-gray-50">
          {/* Store-level diff */}
          {!isNew && hasDiff && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Store field changes</p>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-400 pb-1 border-b border-gray-100 mb-1">
                  <span>Field</span><span>Current</span><span>New value</span>
                </div>
                {Object.entries(diff).map(([f, { from, to }]) => (
                  <DiffRow key={f} field={f} from={from} to={to} />
                ))}
              </div>
            </div>
          )}
          {isNew && (
            <div className="mt-3 text-xs text-gray-500 italic">New store will be created with all fields from dealers.json.</div>
          )}

          {/* Competitors */}
          {storeEntry.competitors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-2">
                Competitors ({storeEntry.competitors.length})
              </p>
              <div className="space-y-1.5">
                {storeEntry.competitors.map(comp => (
                  <CompetitorPreviewRow key={comp.competitor_id} comp={comp} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MATCH_METHOD_BADGE = {
  competitor_id: { label: 'matched by ID', className: 'bg-blue-100 text-blue-700' },
  name_fallback: { label: 'matched by name ⚠ will stamp ID', className: 'bg-amber-100 text-amber-700' },
  new:           { label: 'New', className: 'bg-green-100 text-green-700' },
};

function CompetitorPreviewRow({ comp }) {
  const [open, setOpen] = useState(false);
  const isNew = comp.matchMethod === 'new';
  const diff = isNew ? {} : computeDiff(comp.fields, comp.existing);
  // For name_fallback: always show competitor_id being stamped if it wasn't set
  if (comp.matchMethod === 'name_fallback' && comp.competitor_id && comp.existing && !comp.existing.competitor_id) {
    diff.competitor_id = { from: null, to: comp.competitor_id };
  }
  const hasDiff = Object.keys(diff).length > 0;
  const hasExtra = comp.fields.extra_config_json && Object.keys(comp.fields.extra_config_json).length > 0;
  const matchBadge = MATCH_METHOD_BADGE[comp.matchMethod] || MATCH_METHOD_BADGE.new;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={12} className="text-gray-400 shrink-0" /> : <ChevronRight size={12} className="text-gray-400 shrink-0" />}
        <span className="text-sm text-gray-700 flex-1">{comp.dealer_name}</span>
        <span className="text-xs font-mono text-gray-400 mr-2">{comp.competitor_id}</span>
        {comp.fields.scraper_platform && (
          <span className="text-xs font-mono text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded mr-1">{comp.fields.scraper_platform}</span>
        )}
        {hasExtra && <AlertTriangle size={12} className="text-amber-500 mr-1" title="Has extra fields → extra_config_json" />}
        <Badge className={`text-xs ${matchBadge.className}`}>{matchBadge.label}</Badge>
        {!isNew && (
          <Badge className={`text-xs ml-1 ${hasDiff ? 'bg-slate-100 text-slate-600' : 'bg-gray-100 text-gray-400'}`}>
            {hasDiff ? `${Object.keys(diff).length} changes` : 'no changes'}
          </Badge>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3">
          {isNew && <p className="text-xs text-gray-500 italic mt-1">New competitor will be created.</p>}
          {!isNew && hasDiff && (
            <div className="mt-2">
              <div className="bg-gray-50 rounded p-2">
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-400 pb-1 border-b border-gray-100 mb-1">
                  <span>Field</span><span>Current</span><span>New value</span>
                </div>
                {Object.entries(diff).map(([f, { from, to }]) => (
                  <DiffRow key={f} field={f} from={from} to={to} />
                ))}
              </div>
            </div>
          )}
          {!isNew && !hasDiff && <p className="text-xs text-gray-400 italic mt-1">No changes detected.</p>}
          {hasExtra && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
              <strong>Unknown fields → extra_config_json:</strong>{' '}
              {Object.keys(comp.fields.extra_config_json).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DealersJsonImport() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [rawDebug, setRawDebug] = useState(null);
  // Store parsed JSON while waiting for queries to load
  const pendingParsedRef = useRef(null);

  const { data: existingStores = [], isSuccess: storesLoaded } = useQuery({
    queryKey: ['allStores'],
    queryFn: () => base44.entities.Store.list(),
  });

  const { data: existingCompetitors = [], isSuccess: competitorsLoaded } = useQuery({
    queryKey: ['allCompetitors'],
    queryFn: () => base44.entities.StoreCompetitor.list(),
  });

  const { data: dealerGroups = [], isSuccess: groupsLoaded } = useQuery({
    queryKey: ['dealerGroups'],
    queryFn: () => base44.entities.DealerGroup.list(),
  });

  const dataReady = storesLoaded && competitorsLoaded && groupsLoaded;

  // Once all data loads, rebuild preview if a file was uploaded before data was ready
  useEffect(() => {
    if (dataReady && pendingParsedRef.current) {
      const result = buildPreview(pendingParsedRef.current);
      setPreview(result);
      pendingParsedRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  function buildPreview(parsed) {
    // Build store lookup indexes — priority: scraper_store_id → dealership_key → dealer_id → normalized name
    const storesByScraperId = {};
    const storesByDealershipKey = {};
    const storesByDealerId = {};
    const storesByNormalizedName = {};
    for (const s of existingStores) {
      if (s.scraper_store_id) storesByScraperId[s.scraper_store_id] = s;
      if (s.dealership_key) storesByDealershipKey[s.dealership_key] = s;
      if (s.dealer_id) storesByDealerId[s.dealer_id] = s;
      const normName = (s.name || '').toLowerCase().trim();
      if (normName) storesByNormalizedName[normName] = s;
    }

    const competitorsByCompId = {};
    const competitorsByStoreAndName = {};
    for (const c of existingCompetitors) {
      if (c.competitor_id) competitorsByCompId[c.competitor_id] = c;
      const nameKey = `${c.store_id}__${(c.name || '').toLowerCase().trim()}`;
      competitorsByStoreAndName[nameKey] = c;
    }

    const groupsBySlug = {};
    for (const g of dealerGroups) {
      if (g.slug) groupsBySlug[g.slug] = g.id;
    }

    const entries = [];
    const unknownFields = new Set();

    for (const storeJson of parsed) {
      // Normalize dealer key from all possible top-level fields (priority order per spec)
      const dealerKey =
        storeJson.dealer_id ||
        storeJson.scraper_store_id ||
        storeJson.dealership_key ||
        storeJson.id ||
        null;

      // Match existing store in priority order, track how it was matched
      let existingStore = null;
      let storeMatchMethod = 'none';
      const normStoreName = (storeJson.store_name || storeJson.name || '').toLowerCase().trim();

      if (dealerKey && storesByScraperId[dealerKey]) {
        existingStore = storesByScraperId[dealerKey];
        storeMatchMethod = 'scraper_store_id';
      } else if (dealerKey && storesByDealershipKey[dealerKey]) {
        existingStore = storesByDealershipKey[dealerKey];
        storeMatchMethod = 'dealership_key';
      } else if (dealerKey && storesByDealerId[dealerKey]) {
        existingStore = storesByDealerId[dealerKey];
        storeMatchMethod = 'dealer_id';
      } else if (normStoreName && storesByNormalizedName[normStoreName]) {
        existingStore = storesByNormalizedName[normStoreName];
        storeMatchMethod = 'name';
      }

      // group_id: always preserve existing store's group_id; only use resolved slug for new stores
      const resolvedGroupId = groupsBySlug[storeJson.group_id] || null;
      const groupIdToUse = existingStore?.group_id || resolvedGroupId || null;

      const storeFields = {
        name: storeJson.store_name || storeJson.name,
        scraper_store_id: dealerKey,
        group_id: groupIdToUse,
        scrape_frequency: storeJson.scrape_frequency || 'weekly',
        active: storeJson.active !== false,
        scraper_default_make: storeJson.default_make || null,
      };

      const clientDealer = (storeJson.dealers || []).find(d => d.dealer_type === 'client');
      if (clientDealer) {
        const mapped = mapDealerToEntity(clientDealer);
        Object.assign(storeFields, {
          scraper_platform: mapped.scraper_platform,
          new_inventory_url: mapped.new_inventory_url,
          used_inventory_url: mapped.used_inventory_url,
          new_price_labels_json: mapped.new_price_labels_json,
          used_price_labels_json: mapped.used_price_labels_json,
          facet_labels_json: mapped.facet_labels_json,
          filter_examples_json: mapped.filter_examples_json,
          api_url: mapped.api_url,
          api_key: mapped.api_key,
          api_per_page: mapped.api_per_page,
          api_limit: mapped.api_limit,
          api_type_slug: mapped.api_type_slug,
          api_inventory_types: mapped.api_inventory_types,
          api_sort_field: mapped.api_sort_field,
          api_sort_order: mapped.api_sort_order,
          api_sort: mapped.api_sort,
          api_location_field: mapped.api_location_field,
          api_location_values: mapped.api_location_values,
          dealerinspire_facet_fields: mapped.dealerinspire_facet_fields,
          autofi_dealer_id: mapped.autofi_dealer_id,
          use_autofi_page_price_override: mapped.use_autofi_page_price_override,
          use_autofi_missing_vin_page_fallback: mapped.use_autofi_missing_vin_page_fallback,
          skip_make_param: mapped.skip_make_param,
          extra_config_json: mapped.extra_config_json,
        });
        if (mapped.extra_config_json) {
          Object.keys(mapped.extra_config_json).forEach(k => unknownFields.add(k));
        }
      }

      const resolvedStoreId = existingStore?.id || null;

      const competitors = (storeJson.dealers || [])
        .filter(d => d.dealer_type !== 'client')
        .map(d => {
          const fields = mapDealerToEntity(d);
          if (fields.extra_config_json) {
            Object.keys(fields.extra_config_json).forEach(k => unknownFields.add(k));
          }
          const nameKey = `${resolvedStoreId}__${(d.dealer_name || '').toLowerCase().trim()}`;
          let existing = null;
          let matchMethod = 'new';
          if (d.competitor_id && competitorsByCompId[d.competitor_id]) {
            existing = competitorsByCompId[d.competitor_id];
            matchMethod = 'competitor_id';
          } else if (resolvedStoreId && competitorsByStoreAndName[nameKey]) {
            existing = competitorsByStoreAndName[nameKey];
            matchMethod = 'name_fallback';
          }
          return {
            dealer_name: d.dealer_name,
            competitor_id: d.competitor_id,
            fields,
            existing,
            matchMethod,
          };
        });

      entries.push({
        dealerKey,
        storeMatchMethod,
        store_name: storeJson.store_name || storeJson.name,
        storeFields,
        existing: existingStore,
        competitors,
      });
    }

    const summary = {
      totalNew: entries.filter(e => !e.existing).length,
      totalUpdate: entries.filter(e => {
        if (!e.existing) return false;
        const d = computeDiff(e.storeFields, e.existing);
        delete d.group_id;
        return Object.keys(d).length > 0;
      }).length,
      totalCompNew: entries.flatMap(e => e.competitors).filter(c => !c.existing).length,
      totalCompUpdate: entries.flatMap(e => e.competitors).filter(c => {
        if (!c.existing) return false;
        if (c.matchMethod === 'name_fallback' && c.competitor_id && !c.existing.competitor_id) return true;
        return Object.keys(computeDiff(c.fields, c.existing)).length > 0;
      }).length,
    };

    return { entries, unknownFields: [...unknownFields], summary };
  }

  function handleFileUpload(e) {
    setError(null);
    setImportResult(null);
    setRawDebug(null);
    setPreview(null);
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        // Capture top-level keys of first entry for debugging
        if (parsed.length > 0) {
          const first = parsed[0];
          setRawDebug({
            topLevelKeys: Object.keys(first),
            firstEntry: {
              dealer_id: first.dealer_id,
              id: first.id,
              store_id: first.store_id,
              scraper_store_id: first.scraper_store_id,
              store_name: first.store_name,
              name: first.name,
              group_id: first.group_id,
              dealerCount: (first.dealers || []).length,
              dealerSample: (first.dealers || []).slice(0, 2).map(d => ({ dealer_name: d.dealer_name, dealer_type: d.dealer_type, competitor_id: d.competitor_id })),
            }
          });
        }
        if (!dataReady) {
          // Data not loaded yet — store and wait for useEffect to trigger buildPreview
          pendingParsedRef.current = parsed;
        } else {
          const result = buildPreview(parsed);
          setPreview(result);
        }
      } catch (err) {
        setError('Invalid JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Strip null values so we don't overwrite existing data with nulls
  function stripNulls(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) out[k] = v;
    }
    return out;
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setImportResult(null);

    // Re-build indexes at import time (data may have refreshed)
    const storesByScraperId = {};
    const storesByDealershipKey = {};
    const storesByDealerId = {};
    const storesByNormalizedName = {};
    for (const s of existingStores) {
      if (s.scraper_store_id) storesByScraperId[s.scraper_store_id] = s;
      if (s.dealership_key) storesByDealershipKey[s.dealership_key] = s;
      if (s.dealer_id) storesByDealerId[s.dealer_id] = s;
      const n = (s.name || '').toLowerCase().trim();
      if (n) storesByNormalizedName[n] = s;
    }
    const competitorsByCompId = {};
    const competitorsByStoreAndName = {};
    for (const c of existingCompetitors) {
      if (c.competitor_id) competitorsByCompId[c.competitor_id] = c;
      const nameKey = `${c.store_id}__${(c.name || '').toLowerCase().trim()}`;
      competitorsByStoreAndName[nameKey] = c;
    }

    let storesCreated = 0, storesUpdated = 0, compsCreated = 0, compsUpdated = 0;

    for (const entry of preview.entries) {
      const dk = entry.dealerKey;
      const normName = (entry.store_name || '').toLowerCase().trim();
      const existing =
        (dk && storesByScraperId[dk]) ||
        (dk && storesByDealershipKey[dk]) ||
        (dk && storesByDealerId[dk]) ||
        (normName && storesByNormalizedName[normName]) ||
        null;

      let storeId;
      if (!existing) {
        const created = await base44.entities.Store.create(stripNulls(entry.storeFields));
        storeId = created.id;
        storesCreated++;
      } else {
        const diff = computeDiff(entry.storeFields, existing);
        delete diff.group_id; // NEVER overwrite existing group_id
        if (Object.keys(diff).length > 0) {
          const updates = {};
          for (const [k, { to }] of Object.entries(diff)) updates[k] = to;
          await base44.entities.Store.update(existing.id, updates);
          storesUpdated++;
        }
        storeId = existing.id;
      }

      for (const comp of entry.competitors) {
        const nameKey = `${storeId}__${(comp.dealer_name || '').toLowerCase().trim()}`;
        const existingComp =
          (comp.competitor_id && competitorsByCompId[comp.competitor_id]) ||
          competitorsByStoreAndName[nameKey] ||
          null;
        if (!existingComp) {
          await base44.entities.StoreCompetitor.create(stripNulls({ ...comp.fields, store_id: storeId }));
          compsCreated++;
        } else {
          const diff = computeDiff(comp.fields, existingComp);
          if (comp.matchMethod === 'name_fallback' && comp.competitor_id && !existingComp.competitor_id) {
            diff.competitor_id = { from: null, to: comp.competitor_id };
          }
          if (Object.keys(diff).length > 0) {
            const updates = {};
            for (const [k, { to }] of Object.entries(diff)) updates[k] = to;
            await base44.entities.StoreCompetitor.update(existingComp.id, updates);
            compsUpdated++;
          }
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['allStores'] });
    queryClient.invalidateQueries({ queryKey: ['allCompetitors'] });
    setImportResult({ storesCreated, storesUpdated, compsCreated, compsUpdated });
    setImporting(false);
  }

  function countStoreDiff(entry) {
    if (!entry.existing) return null;
    const d = computeDiff(entry.storeFields, entry.existing);
    delete d.group_id;
    return d;
  }

  const totalNew = preview?.summary?.totalNew ?? 0;
  const totalUpdate = preview?.summary?.totalUpdate ?? 0;
  const totalCompNew = preview?.summary?.totalCompNew ?? 0;
  const totalCompUpdate = preview?.summary?.totalCompUpdate ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Import dealers.json</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Upload your dealers.json to preview changes before saving. Existing values are never overwritten with blank/null.
        </p>
      </div>

      {/* Upload */}
      <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-5 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
        <Upload size={18} className="text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-700">Choose dealers.json</p>
          <p className="text-xs text-gray-400">JSON array format</p>
        </div>
        <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}


      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 space-y-0.5">
          <p className="font-semibold">Import complete</p>
          <p>Stores: {importResult.storesCreated} created, {importResult.storesUpdated} updated</p>
          <p>Competitors: {importResult.compsCreated} created, {importResult.compsUpdated} updated</p>
        </div>
      )}

      {preview && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap gap-3 items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Plus size={13} className="text-green-600" />
              <span className="text-sm font-semibold text-green-700">{totalNew} new stores</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCw size={13} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">{totalUpdate} stores to update</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Plus size={13} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">{totalCompNew} new competitors</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCw size={13} className="text-violet-600" />
              <span className="text-sm font-semibold text-violet-700">{totalCompUpdate} competitors to update</span>
            </div>
            {preview.unknownFields.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <AlertTriangle size={13} className="text-amber-500" />
                <span className="text-xs text-amber-600">Unknown fields → extra_config_json: {preview.unknownFields.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Store rows */}
          <div className="space-y-2">
            {preview.entries.map(entry => (
              <StorePreviewRow
                key={entry.dealerKey || entry.store_name}
                storeEntry={entry}
                existing={entry.existing}
              />
            ))}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
            <span>
              Existing populated values will NOT be overwritten by blank/null. Only non-null values from dealers.json are applied.
              No existing records will be deleted. Unknown fields (teamvelocity_*, dealer_type) go into extra_config_json.
            </span>
          </div>

          <Button
            onClick={handleImport}
            disabled={importing || (totalNew === 0 && totalUpdate === 0 && totalCompNew === 0 && totalCompUpdate === 0)}
            className="w-full sm:w-auto"
          >
            {importing ? 'Importing…' : `Apply Import (${totalNew + totalUpdate} stores, ${totalCompNew + totalCompUpdate} competitors)`}
          </Button>
        </>
      )}
    </div>
  );
}