import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// KPI summary: { total_leads, total_sold, sold_pct, total_appts_set }
// Pass leadType='Internet' to restrict to internet leads only
export function useLeadKpiSummary(dealerIds, startDate, endDate, enabled = true, leadType = null) {
  return useQuery({
    queryKey: ['lead_kpi_summary', dealerIds?.join(','), startDate, endDate, leadType],
    enabled: enabled && !!dealerIds && dealerIds.length > 0 && !!startDate && !!endDate,
    staleTime: 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseLeadKpiSummary', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
        ...(leadType ? { lead_type: leadType } : {}),
      });
      return res.data;
    },
  });
}

// Dealer ranking: [{ dealer_id, total_leads, total_sold, sold_pct, total_appts_set }]
// Pass leadType='Internet' to restrict to internet leads only
export function useDealerRanking(dealerIds, startDate, endDate, enabled = true, leadType = null) {
  return useQuery({
    queryKey: ['dealer_ranking', dealerIds?.join(','), startDate, endDate, leadType],
    enabled: enabled && !!dealerIds && dealerIds.length > 0 && !!startDate && !!endDate,
    staleTime: 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseDealerRanking', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
        ...(leadType ? { lead_type: leadType } : {}),
      });
      return res.data?.data || [];
    },
  });
}

// Daily trend: [{ report_date, total_leads, total_sold, sold_pct, total_appts_set }]
export function useLeadTrend(dealerIds, startDate, endDate, enabled = true, partyType = null) {
  return useQuery({
    queryKey: ['lead_trend', dealerIds?.join(','), startDate, endDate, partyType],
    enabled: enabled && !!dealerIds && dealerIds.length > 0 && !!startDate && !!endDate,
    staleTime: 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseLeadTrend', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
        ...(partyType ? { party_type: partyType } : {}),
      });
      return res.data?.data || [];
    },
  });
}


// Lead type breakdown: [{ lead_type, inventory_type, total_leads, total_sold, sold_pct, total_appts_set }]
export function useLeadTypeBreakdown(dealerIds, startDate, endDate, enabled = true) {
  return useQuery({
    queryKey: ['lead_type_breakdown', dealerIds?.join(','), startDate, endDate],
    enabled: enabled && !!dealerIds && dealerIds.length > 0 && !!startDate && !!endDate,
    staleTime: 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseLeadTypeBreakdown', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
      });
      return res.data?.data || [];
    },
  });
}

// Vendor summary: [{ dealer_id, lead_source, total_leads, total_sold, sold_pct, total_appts_set, total_gross }]
export function useVendorSummary(dealerIds, startDate, endDate, enabled = true, inventoryType = null) {
  return useQuery({
    queryKey: ['vendor_summary', dealerIds?.join(','), startDate, endDate, inventoryType],
    enabled: enabled && !!dealerIds && dealerIds.length > 0 && !!startDate && !!endDate,
    staleTime: 0,
    queryFn: async () => {
      const res = await base44.functions.invoke('supabaseVendorSummary', {
        dealer_ids: dealerIds,
        start_date: startDate,
        end_date: endDate,
        inventory_type: inventoryType,
      });
      return res.data?.data || [];
    },
  });
}