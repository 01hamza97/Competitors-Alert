import { NextResponse } from 'next/server';
import {
  handleLeadPerformance,
  handleLeadPerformanceAgg,
  handleLeadKpiSummary,
  handleDealerRanking,
  handleLeadTrend,
  handleLeadTypeBreakdown,
  handleVendorSummary,
  handleAppointments,
  handleActivityData,
  handleDealers,
  handleCompetitorInventory,
  handleCompetitorVehicleSpecials,
  handleCompetitorServiceSpecials,
  handleClientInventory,
  handleAskSam,
  handleGetSpecialsStaging,
  handleApproveSpecial,
  handleRejectSpecial,
  handleAutoLoadSpecials,
  handleSaveSpecials,
  handleResetSpecialOverride,
  handleScraperInventoryHealth,
  handleTriggerScraper,
  handleSendPreviewEmail,
} from '@/lib/functionsBackend';

const FUNCTION_HANDLERS = {
  supabaseLeadPerformance: handleLeadPerformance,
  supabaseLeadPerformanceAgg: handleLeadPerformanceAgg,
  supabaseLeadKpiSummary: handleLeadKpiSummary,
  supabaseDealerRanking: handleDealerRanking,
  supabaseLeadTrend: handleLeadTrend,
  supabaseLeadTypeBreakdown: handleLeadTypeBreakdown,
  supabaseVendorSummary: handleVendorSummary,
  supabaseAppointments: handleAppointments,
  supabaseActivityData: handleActivityData,
  supabaseDealers: handleDealers,
  supabaseCompetitorInventory: handleCompetitorInventory,
  supabaseCompetitorVehicleSpecials: handleCompetitorVehicleSpecials,
  supabaseCompetitorServiceSpecials: handleCompetitorServiceSpecials,
  supabaseClientInventory: handleClientInventory,
  askSam: handleAskSam,
  getSpecialsStaging: handleGetSpecialsStaging,
  approveSpecial: handleApproveSpecial,
  rejectSpecial: handleRejectSpecial,
  autoLoadSpecials: handleAutoLoadSpecials,
  saveSpecials: handleSaveSpecials,
  resetSpecialOverride: handleResetSpecialOverride,
  scraperInventoryHealth: handleScraperInventoryHealth,
  triggerScraper: handleTriggerScraper,
  sendPreviewEmail: handleSendPreviewEmail,
};

export async function POST(request, { params }) {
  try {
    const { name } = await params;
    const handler = FUNCTION_HANDLERS[name];
    if (!handler) {
      console.warn(`[API functions] Unknown function: ${name}`);
      return NextResponse.json({ error: `Function ${name} not found` }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const result = await handler(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[API functions] Error in ${params.name}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
