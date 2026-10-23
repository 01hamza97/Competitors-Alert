import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getPeriodRange } from '@/components/dashboard/PerformanceKPIs';
import { subMonths, subYears, format } from 'date-fns';

// Convert a raw daily_lead_performance row into the shape our components expect
// Normalize lead_type values from Supabase to consistent app values
function normalizeLeadType(lt) {
  if (!lt) return 'Unknown';
  const s = lt.trim();
  if (s === 'Walk-in' || s === 'Walk-In' || s === 'Walkin') return 'Walk In';
  if (s === 'Wholesale') return 'Unknown'; // treat wholesale as unknown
  return s;
}

// Normalize a dealer_id/dealership_key to a canonical form for matching
export function normalizeDealerId(id) {
  if (!id) return '';
  return id.trim().toLowerCase().replace(/\s+/g, '_');
}

export function normalizeLPRow(row) {
  return {
    // identity
    dealer_id: normalizeDealerId(row.dealer_id),
    date: row.report_date ? row.report_date.substring(0, 10) : null,
    lead_source: row.lead_source || null,
    lead_type: normalizeLeadType(row.lead_type),
    inventory_type: row.inventory_type || 'Unknown',
    // per-row metrics
    good_leads: row.good_leads || 0,
    appts_set: row.appts_set || 0,
    sold: row.sold || 0,
    gross: row.gross || 0,
  };
}

// Fetch lead performance data for given dealer_ids + period
export function useLeadPerformance(dealerIds, period, enabled = true) {
  const { start, end } = getPeriodRange(period);
  return useQuery({
    queryKey: ['supabase_lead_perf', dealerIds?.join(','), start, end],
    enabled: enabled && !!dealerIds && dealerIds.length > 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseLeadPerformance', {
        dealer_ids: dealerIds,
        start_date: start,
        end_date: end,
      });
      return (res.data?.data || []).map(normalizeLPRow);
    },
  });
}

// Fetch lead performance for a wider range using the aggregated endpoint (no lead_source).
// Used for trend/KPI charts which only need totals + lead_type breakdown.
export function useLeadPerformanceRange(dealerIds, startDate, endDate, enabled = true) {
  return useQuery({
    queryKey: ['supabase_lead_perf_range_agg', dealerIds?.join(','), startDate, endDate],
    enabled: enabled && !!dealerIds && dealerIds.length > 0 && !!startDate,
    staleTime: 0,
    queryFn: async () => {
      console.log('[useLeadPerformanceRange] REQUEST →', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
      });
      const res = await base44.functions.invoke('supabaseLeadPerformanceAgg', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
      });
      const raw = res.data?.data || [];
      const uniqueDates = [...new Set(raw.map(r => r.report_date))].sort();
      console.log('[useLeadPerformanceRange] RESPONSE ←', {
        total_rows: raw.length,
        unique_report_dates: uniqueDates,
        first_row: raw[0] ?? null,
      });
      return raw.map(normalizeLPRow);
    },
  });
}

// Fetch raw lead performance rows including lead_source (used for Vendor Performance page).
// Uses the ungrouped endpoint so lead_source is preserved.
export function useLeadPerformanceRangeRaw(dealerIds, startDate, endDate, enabled = true) {
  // Normalize dealer IDs before sending to backend so they match Supabase's dealer_id format
  const normalizedIds = dealerIds ? dealerIds.map(normalizeDealerId).filter(Boolean) : [];
  return useQuery({
    queryKey: ['supabase_lead_perf_range_raw', normalizedIds.join(','), startDate, endDate],
    enabled: enabled && normalizedIds.length > 0 && !!startDate,
    staleTime: 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseLeadPerformance', {
        dealer_ids: normalizedIds,
        start_date: startDate,
        end_date: endDate,
      });
      return (res.data?.data || []).map(normalizeLPRow);
    },
  });
}

// Fetch salesperson activity
export function useActivityData(dealerIds, period, enabled = true) {
  const { start, end } = getPeriodRange(period);
  return useQuery({
    queryKey: ['supabase_activity', dealerIds?.join(','), start, end],
    enabled: enabled && !!dealerIds && dealerIds.length > 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseActivityData', {
        dealer_ids: dealerIds,
        start_date: start,
        end_date: end,
      });
      return res.data?.data || [];
    },
  });
}

// Fetch appointment snapshots (most recent snapshot for the dealers)
export function useAppointmentSnapshots(dealerIds, enabled = true) {
  return useQuery({
    queryKey: ['supabase_appointments', dealerIds?.join(',')],
    enabled: enabled && !!dealerIds && dealerIds.length > 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseAppointments', {
        dealer_ids: dealerIds,
      });
      return {
        data: res.data?.data || [],
        snapshot_date: res.data?.snapshot_date || null,
      };
    },
  });
}

// Fetch all dealers from Supabase
export function useSupabaseDealers(enabled = true) {
  return useQuery({
    queryKey: ['supabase_dealers'],
    enabled,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseDealers', {});
      return res.data?.data || [];
    },
  });
}

// Helper: aggregate normalized LP rows into totals + lead type breakdown
export function aggregateLPRows(rows) {
  let totalLeads = 0, totalSold = 0, totalGross = 0, totalAppts = 0;
  const byLeadType = {};
  const bySource = {};
  const byInventory = {};

  rows.forEach(r => {
    totalLeads += r.good_leads;
    totalSold += r.sold;
    totalGross += r.gross;
    totalAppts += r.appts_set;

    // Group by actual lead_type from Supabase
    const lt = r.lead_type || 'Unknown';
    if (!byLeadType[lt]) byLeadType[lt] = { leads: 0, sold: 0 };
    byLeadType[lt].leads += r.good_leads;
    byLeadType[lt].sold += r.sold;

    const src = r.lead_source || 'Unknown';
    if (!bySource[src]) bySource[src] = { leads: 0, sold: 0, gross: 0, appts: 0 };
    bySource[src].leads += r.good_leads;
    bySource[src].sold += r.sold;
    bySource[src].gross += r.gross;
    bySource[src].appts += r.appts_set;

    const inv = r.inventory_type || 'Unknown';
    if (!byInventory[inv]) byInventory[inv] = { leads: 0, sold: 0 };
    byInventory[inv].leads += r.good_leads;
    byInventory[inv].sold += r.sold;
  });

  return {
    leads: totalLeads,
    sold: totalSold,
    gross: totalGross,
    appts: totalAppts,
    soldPct: totalLeads > 0 ? Math.round((totalSold / totalLeads) * 100) : 0,
    byLeadType,
    bySource,
    byInventory,
  };
}

// Get a wide date range that covers both current period + compare period.
// Always uses the actual period (not an effective/substituted one) so the
// compare shift is applied to the same dates that getCompareRange uses.
export function getWideRange(period, compare) {
  const { start, end } = getPeriodRange(period);
  if (!compare) return { start, end };
  const shiftFn = compare === 'lastMonth' ? d => subMonths(d, 1) : d => subYears(d, 1);
  const cmpStart = format(shiftFn(new Date(start + 'T00:00:00')), 'yyyy-MM-dd');
  const cmpEnd = format(shiftFn(new Date(end + 'T00:00:00')), 'yyyy-MM-dd');
  const wideStart = cmpStart < start ? cmpStart : start;
  const wideEnd = cmpEnd > end ? cmpEnd : end;
  return { start: wideStart, end: wideEnd };
}