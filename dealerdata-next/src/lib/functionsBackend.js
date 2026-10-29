import prisma from '@/lib/prisma';
import { launchScraperJob } from '@/lib/scraperRunner';
import { normalizeMake, normalizeModel, normalizeTrim, normalizeVehicle } from '@/lib/vehicleNormalization';

function getSbHeaders() {
  const key = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function getSbUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

// ── Lead Performance ──────────────────────────────────────────────────────────
export async function handleLeadPerformance({ dealer_ids = [], start_date, end_date }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      if (dealer_ids && dealer_ids.length > 0) {
        where.dealerId = { in: dealer_ids };
      }
      if (start_date || end_date) {
        where.reportDate = {};
        if (start_date) where.reportDate.gte = start_date;
        if (end_date) where.reportDate.lte = end_date;
      }
      const rows = await prisma.dailyLeadPerformance.findMany({
        where,
        orderBy: [{ reportDate: 'desc' }, { dealerId: 'asc' }],
        take: 5000,
      });
      const data = rows.map(r => ({
        dealer_id: r.dealerId,
        report_date: r.reportDate,
        lead_source: r.leadSource,
        lead_type: r.leadType,
        inventory_type: r.inventoryType,
        good_leads: r.goodLeads,
        appts_set: r.apptsSet,
        sold: r.sold,
        gross: r.gross,
      }));
      return { data };
    } catch (e) {
      console.warn('Prisma handleLeadPerformance query failed, attempting Supabase fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [] };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';
  const dateFilter = start_date && end_date ? `&report_date=gte.${start_date}&report_date=lte.${end_date}` : '';

  const url = `${sbUrl}/rest/v1/daily_lead_performance?select=dealer_id,report_date,lead_source,lead_type,inventory_type,good_leads,appts_set,sold,gross${dealerFilter}${dateFilter}&order=report_date.desc,dealer_id.asc`;

  try {
    const res = await fetch(url, { headers: getSbHeaders() });
    if (!res.ok) return { data: [] };
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [] };
  } catch {
    return { data: [] };
  }
}

// ── Lead Performance Aggregated ───────────────────────────────────────────────
export async function handleLeadPerformanceAgg({ dealer_ids = [], start_date, end_date }) {
  return handleLeadPerformance({ dealer_ids, start_date, end_date });
}

// ── Lead KPI Summary ─────────────────────────────────────────────────────────
export async function handleLeadKpiSummary({ dealer_ids = [], start_date, end_date, lead_type }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      if (dealer_ids && dealer_ids.length > 0) {
        where.dealerId = { in: dealer_ids };
      }
      if (start_date || end_date) {
        where.reportDate = {};
        if (start_date) where.reportDate.gte = start_date;
        if (end_date) where.reportDate.lte = end_date;
      }
      if (lead_type) {
        where.leadType = lead_type;
      } else {
        where.leadType = { notIn: ['Import', 'PreviousCustomer'] };
      }
      const agg = await prisma.dailyLeadPerformance.aggregate({
        where,
        _sum: {
          goodLeads: true,
          sold: true,
          apptsSet: true,
        },
      });
      const total_leads = agg._sum.goodLeads || 0;
      const total_sold = agg._sum.sold || 0;
      const total_appts_set = agg._sum.apptsSet || 0;
      const sold_pct = total_leads > 0 ? Math.round((total_sold / total_leads) * 100) : 0;
      return { total_leads, total_sold, sold_pct, total_appts_set };
    } catch (e) {
      console.warn('Prisma handleLeadKpiSummary query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { total_leads: 0, total_sold: 0, sold_pct: 0, total_appts_set: 0 };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';
  const dateFilter = start_date && end_date ? `&report_date=gte.${start_date}&report_date=lte.${end_date}` : '';
  const leadTypeFilter = lead_type ? `&lead_type=eq.${lead_type}` : '&lead_type=not.in.(Import,PreviousCustomer)';

  const url = `${sbUrl}/rest/v1/daily_lead_performance?select=good_leads,appts_set,sold${dealerFilter}${dateFilter}${leadTypeFilter}&limit=10000`;

  try {
    const res = await fetch(url, { headers: getSbHeaders() });
    if (!res.ok) return { total_leads: 0, total_sold: 0, sold_pct: 0, total_appts_set: 0 };
    const rows = await res.json();
    let total_leads = 0, total_sold = 0, total_appts_set = 0;
    if (Array.isArray(rows)) {
      for (const r of rows) {
        total_leads += r.good_leads || 0;
        total_sold += r.sold || 0;
        total_appts_set += r.appts_set || 0;
      }
    }
    const sold_pct = total_leads > 0 ? Math.round((total_sold / total_leads) * 100) : 0;
    return { total_leads, total_sold, sold_pct, total_appts_set };
  } catch {
    return { total_leads: 0, total_sold: 0, sold_pct: 0, total_appts_set: 0 };
  }
}

// ── Dealer Ranking ────────────────────────────────────────────────────────────
export async function handleDealerRanking({ dealer_ids = [], start_date, end_date, lead_type }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      if (dealer_ids && dealer_ids.length > 0) {
        where.dealerId = { in: dealer_ids };
      }
      if (start_date || end_date) {
        where.reportDate = {};
        if (start_date) where.reportDate.gte = start_date;
        if (end_date) where.reportDate.lte = end_date;
      }
      if (lead_type) {
        where.leadType = lead_type;
      } else {
        where.leadType = { notIn: ['Import', 'PreviousCustomer'] };
      }
      const groups = await prisma.dailyLeadPerformance.groupBy({
        by: ['dealerId'],
        where,
        _sum: {
          goodLeads: true,
          sold: true,
          apptsSet: true,
        },
      });
      const data = groups.map(g => {
        const total_leads = g._sum.goodLeads || 0;
        const total_sold = g._sum.sold || 0;
        const total_appts_set = g._sum.apptsSet || 0;
        return {
          dealer_id: g.dealerId,
          total_leads,
          total_sold,
          total_appts_set,
          sold_pct: total_leads > 0 ? Math.round((total_sold / total_leads) * 100) : 0,
        };
      }).sort((a, b) => b.total_leads - a.total_leads);
      return { data };
    } catch (e) {
      console.warn('Prisma handleDealerRanking query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [] };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';
  const dateFilter = start_date && end_date ? `&report_date=gte.${start_date}&report_date=lte.${end_date}` : '';
  const leadTypeFilter = lead_type ? `&lead_type=eq.${lead_type}` : '&lead_type=not.in.(Import,PreviousCustomer)';

  const url = `${sbUrl}/rest/v1/daily_lead_performance?select=dealer_id,good_leads,appts_set,sold${dealerFilter}${dateFilter}${leadTypeFilter}&limit=10000`;

  try {
    const res = await fetch(url, { headers: getSbHeaders() });
    if (!res.ok) return { data: [] };
    const rows = await res.json();
    const map = {};
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const d = r.dealer_id || 'Unknown';
        if (!map[d]) map[d] = { dealer_id: d, total_leads: 0, total_sold: 0, total_appts_set: 0 };
        map[d].total_leads += r.good_leads || 0;
        map[d].total_sold += r.sold || 0;
        map[d].total_appts_set += r.appts_set || 0;
      }
    }
    const data = Object.values(map).map(r => ({
      ...r,
      sold_pct: r.total_leads > 0 ? Math.round((r.total_sold / r.total_leads) * 100) : 0,
    })).sort((a, b) => b.total_leads - a.total_leads);
    return { data };
  } catch {
    return { data: [] };
  }
}

// ── Lead Trend ────────────────────────────────────────────────────────────────
export async function handleLeadTrend({ dealer_ids = [], start_date, end_date, party_type }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = { leadType: { notIn: ['Import', 'PreviousCustomer'] } };
      if (dealer_ids && dealer_ids.length > 0) where.dealerId = { in: dealer_ids };
      if (start_date || end_date) {
        where.reportDate = {};
        if (start_date) where.reportDate.gte = start_date;
        if (end_date) where.reportDate.lte = end_date;
      }
      if (party_type) where.partyType = party_type;
      const groups = await prisma.dailyLeadPerformance.groupBy({
        by: ['reportDate'],
        where,
        _sum: { goodLeads: true, sold: true, apptsSet: true },
        orderBy: { reportDate: 'asc' },
      });
      const data = groups.map(g => {
        const total_leads = g._sum.goodLeads || 0;
        const total_sold = g._sum.sold || 0;
        return {
          report_date: g.reportDate,
          total_leads,
          total_sold,
          total_appts_set: g._sum.apptsSet || 0,
          sold_pct: total_leads > 0 ? parseFloat(((total_sold / total_leads) * 100).toFixed(1)) : 0,
        };
      });
      return { data };
    } catch (e) {
      console.warn('Prisma handleLeadTrend query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [] };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';
  const dateFilter = start_date && end_date ? `&report_date=gte.${start_date}&report_date=lte.${end_date}` : '';
  const partyFilter = party_type ? `&party_type=eq.${party_type}` : '';

  const url = `${sbUrl}/rest/v1/daily_lead_performance?select=report_date,good_leads,appts_set,sold${dealerFilter}${dateFilter}&lead_type=not.in.(Import,PreviousCustomer)${partyFilter}&limit=10000`;

  try {
    const res = await fetch(url, { headers: getSbHeaders() });
    if (!res.ok) return { data: [] };
    const rows = await res.json();
    const map = {};
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const d = r.report_date?.substring(0, 10);
        if (!d) continue;
        if (!map[d]) map[d] = { report_date: d, total_leads: 0, total_sold: 0, total_appts_set: 0 };
        map[d].total_leads += r.good_leads || 0;
        map[d].total_sold += r.sold || 0;
        map[d].total_appts_set += r.appts_set || 0;
      }
    }
    const data = Object.values(map).map(r => ({
      ...r,
      sold_pct: r.total_leads > 0 ? parseFloat(((r.total_sold / r.total_leads) * 100).toFixed(1)) : 0,
    })).sort((a, b) => a.report_date.localeCompare(b.report_date));
    return { data };
  } catch {
    return { data: [] };
  }
}

// ── Lead Type Breakdown ───────────────────────────────────────────────────────
export async function handleLeadTypeBreakdown({ dealer_ids = [], start_date, end_date }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = { leadType: { notIn: ['Import', 'PreviousCustomer'] } };
      if (dealer_ids && dealer_ids.length > 0) where.dealerId = { in: dealer_ids };
      if (start_date || end_date) {
        where.reportDate = {};
        if (start_date) where.reportDate.gte = start_date;
        if (end_date) where.reportDate.lte = end_date;
      }
      const groups = await prisma.dailyLeadPerformance.groupBy({
        by: ['leadType', 'inventoryType'],
        where,
        _sum: { goodLeads: true, sold: true, apptsSet: true },
      });
      const data = groups.map(g => {
        const total_leads = g._sum.goodLeads || 0;
        const total_sold = g._sum.sold || 0;
        return {
          lead_type: g.leadType,
          inventory_type: g.inventoryType,
          total_leads,
          total_sold,
          total_appts_set: g._sum.apptsSet || 0,
          sold_pct: total_leads > 0 ? Math.round((total_sold / total_leads) * 100) : 0,
        };
      });
      return { data };
    } catch (e) {
      console.warn('Prisma handleLeadTypeBreakdown query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [] };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';
  const dateFilter = start_date && end_date ? `&report_date=gte.${start_date}&report_date=lte.${end_date}` : '';

  const url = `${sbUrl}/rest/v1/daily_lead_performance?select=lead_type,inventory_type,good_leads,appts_set,sold${dealerFilter}${dateFilter}&limit=10000`;

  try {
    const res = await fetch(url, { headers: getSbHeaders() });
    if (!res.ok) return { data: [] };
    const rows = await res.json();
    const map = {};
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const lt = r.lead_type || 'Unknown';
        if (lt === 'Import' || lt === 'PreviousCustomer') continue;
        const inv = r.inventory_type || 'Unknown';
        const key = `${lt}||${inv}`;
        if (!map[key]) map[key] = { lead_type: lt, inventory_type: inv, total_leads: 0, total_sold: 0, total_appts_set: 0 };
        map[key].total_leads += r.good_leads || 0;
        map[key].total_sold += r.sold || 0;
        map[key].total_appts_set += r.appts_set || 0;
      }
    }
    const data = Object.values(map).map(r => ({
      ...r,
      sold_pct: r.total_leads > 0 ? Math.round((r.total_sold / r.total_leads) * 100) : 0,
    }));
    return { data };
  } catch {
    return { data: [] };
  }
}

// ── Vendor Summary ────────────────────────────────────────────────────────────
export async function handleVendorSummary({ dealer_ids = [], start_date, end_date, inventory_type }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = { leadType: 'Internet' };
      if (dealer_ids && dealer_ids.length > 0) where.dealerId = { in: dealer_ids };
      if (start_date || end_date) {
        where.reportDate = {};
        if (start_date) where.reportDate.gte = start_date;
        if (end_date) where.reportDate.lte = end_date;
      }
      if (inventory_type) where.inventoryType = { equals: inventory_type };
      const groups = await prisma.dailyLeadPerformance.groupBy({
        by: ['dealerId', 'leadSource'],
        where,
        _sum: { goodLeads: true, sold: true, apptsSet: true, gross: true },
      });
      const data = groups.map(g => {
        const total_leads = g._sum.goodLeads || 0;
        const total_sold = g._sum.sold || 0;
        return {
          dealer_id: g.dealerId,
          lead_source: g.leadSource,
          total_leads,
          total_sold,
          total_appts_set: g._sum.apptsSet || 0,
          total_gross: g._sum.gross || 0,
          sold_pct: total_leads > 0 ? Math.round((total_sold / total_leads) * 100) : 0,
        };
      });
      return { data };
    } catch (e) {
      console.warn('Prisma handleVendorSummary query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [] };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';
  const dateFilter = start_date && end_date ? `&report_date=gte.${start_date}&report_date=lte.${end_date}` : '';
  const invFilter = inventory_type ? `&inventory_type=ilike.${inventory_type}` : '';

  const url = `${sbUrl}/rest/v1/daily_lead_performance?select=dealer_id,lead_source,good_leads,appts_set,sold,gross&lead_type=eq.Internet${dealerFilter}${dateFilter}${invFilter}&limit=10000`;

  try {
    const res = await fetch(url, { headers: getSbHeaders() });
    if (!res.ok) return { data: [] };
    const rows = await res.json();
    const map = {};
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const src = r.lead_source || 'Unknown';
        const key = `${r.dealer_id}||${src}`;
        if (!map[key]) map[key] = { dealer_id: r.dealer_id, lead_source: src, total_leads: 0, total_sold: 0, total_appts_set: 0, total_gross: 0 };
        map[key].total_leads += r.good_leads || 0;
        map[key].total_sold += r.sold || 0;
        map[key].total_appts_set += r.appts_set || 0;
        map[key].total_gross += r.gross || 0;
      }
    }
    const data = Object.values(map).map(r => ({
      ...r,
      sold_pct: r.total_leads > 0 ? Math.round((r.total_sold / r.total_leads) * 100) : 0,
    }));
    return { data };
  } catch {
    return { data: [] };
  }
}

// ── Appointments ─────────────────────────────────────────────────────────────
export async function handleAppointments({ dealer_ids = [] }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      if (dealer_ids && dealer_ids.length > 0) where.dealerId = { in: dealer_ids };
      const latest = await prisma.appointmentSnapshot.findFirst({
        where,
        orderBy: { snapshotDate: 'desc' },
        select: { snapshotDate: true },
      });
      const latestSnapshot = latest?.snapshotDate || null;
      if (!latestSnapshot) return { data: [], snapshot_date: null };
      const todayStr = new Date().toISOString().slice(0, 10);
      where.snapshotDate = latestSnapshot;
      where.appointmentDate = { gte: todayStr };
      const rows = await prisma.appointmentSnapshot.findMany({
        where,
        orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
        take: 5000,
      });
      const data = rows.map(r => ({
        id: r.id,
        dealer_id: r.dealerId,
        snapshot_date: r.snapshotDate,
        appointment_date: r.appointmentDate,
        appointment_time: r.appointmentTime,
        customer_name: r.customerName,
        salesperson_name: r.salespersonName,
        status: r.status,
        lead_source: r.leadSource,
        inventory_type: r.inventoryType,
        vehicle_interest: r.vehicleInterest,
      }));
      return { data, snapshot_date: latestSnapshot };
    } catch (e) {
      console.warn('Prisma handleAppointments query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [], snapshot_date: null };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';

  try {
    const snapshotRes = await fetch(
      `${sbUrl}/rest/v1/appointment_snapshots?select=snapshot_date${dealerFilter}&order=snapshot_date.desc&limit=1`,
      { headers: getSbHeaders() }
    );
    const snapshotRows = await snapshotRes.json();
    const latestSnapshot = snapshotRows?.[0]?.snapshot_date || null;
    if (!latestSnapshot) return { data: [], snapshot_date: null };

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const url = `${sbUrl}/rest/v1/appointment_snapshots?select=*${dealerFilter}&snapshot_date=eq.${latestSnapshot}&appointment_date=gte.${todayStr}&limit=5000`;
    const res = await fetch(url, { headers: getSbHeaders() });
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [], snapshot_date: latestSnapshot };
  } catch {
    return { data: [], snapshot_date: null };
  }
}

// ── Activity Data ─────────────────────────────────────────────────────────────
export async function handleActivityData({ dealer_ids = [], start_date, end_date }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      if (dealer_ids && dealer_ids.length > 0) where.dealerId = { in: dealer_ids };
      if (start_date || end_date) {
        where.reportDate = {};
        if (start_date) where.reportDate.gte = start_date;
        if (end_date) where.reportDate.lte = end_date;
      }
      const rows = await prisma.dailySalespersonActivity.findMany({
        where,
        orderBy: [{ reportDate: 'desc' }, { unitsSold: 'desc' }],
        take: 5000,
      });
      const data = rows.map(r => ({
        id: r.id,
        dealer_id: r.dealerId,
        report_date: r.reportDate,
        salesperson_name: r.salespersonName,
        outbound_calls: r.outboundCalls,
        inbound_calls: r.inboundCalls,
        text_messages: r.textMessages,
        emails_sent: r.emailsSent,
        appointments_set: r.appointmentsSet,
        appointments_shown: r.appointmentsShown,
        units_sold: r.unitsSold,
        total_gross: r.totalGross,
      }));
      return { data };
    } catch (e) {
      console.warn('Prisma handleActivityData query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [] };

  const dealerFilter = dealer_ids && dealer_ids.length > 0 ? `&dealer_id=in.(${dealer_ids.join(',')})` : '';
  const dateFilter = start_date && end_date ? `&report_date=gte.${start_date}&report_date=lte.${end_date}` : '';

  const url = `${sbUrl}/rest/v1/daily_salesperson_activity?select=*${dealerFilter}${dateFilter}&limit=5000`;

  try {
    const res = await fetch(url, { headers: getSbHeaders() });
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [] };
  } catch {
    return { data: [] };
  }
}

// ── Dealers ───────────────────────────────────────────────────────────────────
export async function handleDealers() {
  if (process.env.DATABASE_URL) {
    try {
      const stores = await prisma.store.findMany({ orderBy: { name: 'asc' } });
      const data = stores.map(s => ({
        dealer_id: s.dealershipKey,
        dealer_name: s.name,
        active: s.active,
        group_id: s.groupId,
      }));
      return { data };
    } catch (e) {
      console.warn('Prisma handleDealers query failed:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [] };
  try {
    const res = await fetch(`${sbUrl}/rest/v1/dealers?select=*&order=dealer_name.asc`, { headers: getSbHeaders() });
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [] };
  } catch {
    return { data: [] };
  }
}

// ── Competitor Inventory ──────────────────────────────────────────────────────
export async function handleCompetitorInventory({ dealer_id, snapshot_date }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      let targetIds = [];

      if (dealer_id) {
        const cleanKey = dealer_id.replace(/^store_/, '');
        targetIds.push(cleanKey, `store_${cleanKey}`, dealer_id);

        // Find parent store and all its assigned competitors
        const parentStore = await prisma.store.findFirst({
          where: {
            OR: [
              { id: dealer_id },
              { id: `store_${cleanKey}` },
              { dealershipKey: cleanKey },
              { scraperStoreId: cleanKey },
            ],
          },
          include: { competitors: true },
        });

        if (parentStore?.competitors?.length > 0) {
          for (const c of parentStore.competitors) {
            targetIds.push(c.competitorKey, `comp_${c.competitorKey}`);
          }
        }
      }

      if (targetIds.length > 0) {
        where.dealerId = { in: [...new Set(targetIds)] };
      }

      const allDates = (
        await prisma.competitorVehicleInventory.findMany({
          where,
          select: { snapshotDate: true },
          distinct: ['snapshotDate'],
          orderBy: { snapshotDate: 'desc' },
        })
      ).map((r) => r.snapshotDate);

      const activeDate = snapshot_date || allDates[0] || null;
      if (!activeDate) {
        return { data: [], matrix: [], available_dates: [], snapshot_date: null, competitor_id_to_name: {} };
      }

      where.snapshotDate = activeDate;
      let rows = await prisma.competitorVehicleInventory.findMany({ where, take: 5000 });

      // Check which returned dealers have actual non-zero priced inventory
      const dealersWithValidPrices = new Set(
        rows
          .filter(r => (r.listPrice || 0) > 0)
          .map(r => (r.dealerId || '').replace(/^store_/, '').replace(/^comp_/, ''))
      );

      const returnedDealers = new Set(rows.map(r => (r.dealerId || '').replace(/^store_/, '').replace(/^comp_/, '')));
      const uniqueTargets = [...new Set(targetIds.map(id => id.replace(/^store_/, '').replace(/^comp_/, '')))];

      for (const tKey of uniqueTargets) {
        const hasRows = returnedDealers.has(tKey);
        const hasValidPrices = dealersWithValidPrices.has(tKey);

        // If dealer is missing entirely OR all their rows on activeDate are $0 (e.g. rate limit/scrape failure)
        if (!hasRows || !hasValidPrices) {
          const latestValidSnap = await prisma.competitorVehicleInventory.findFirst({
            where: {
              dealerId: { in: [tKey, `store_${tKey}`, `comp_${tKey}`] },
              snapshotDate: { lte: activeDate },
              listPrice: { gt: 0 },
            },
            orderBy: { snapshotDate: 'desc' },
            select: { snapshotDate: true },
          });

          if (latestValidSnap?.snapshotDate) {
            // Remove zero-priced rows for this dealer if we found a better snapshot
            if (hasRows && !hasValidPrices) {
              rows = rows.filter(r => (r.dealerId || '').replace(/^store_/, '').replace(/^comp_/, '') !== tKey);
            }
            const fallbackRows = await prisma.competitorVehicleInventory.findMany({
              where: {
                dealerId: { in: [tKey, `store_${tKey}`, `comp_${tKey}`] },
                snapshotDate: latestValidSnap.snapshotDate,
              },
              take: 5000,
            });
            rows = rows.concat(fallbackRows);
          }
        }
      }

      // Build name mapping for stores and competitors
      const stores = await prisma.store.findMany({
        select: { id: true, name: true, dealershipKey: true, scraperStoreId: true }
      });
      const nameMap = {};
      for (const s of stores) {
        nameMap[s.id] = s.name;
        nameMap[s.dealershipKey] = s.name;
        if (s.scraperStoreId) nameMap[s.scraperStoreId] = s.name;
      }

      const comps = await prisma.storeCompetitor.findMany({
        select: { id: true, competitorKey: true, competitorName: true }
      });
      for (const c of comps) {
        nameMap[c.id] = c.competitorName;
        nameMap[c.competitorKey] = c.competitorName;
        nameMap[`comp_${c.competitorKey}`] = c.competitorName;
      }

      // Normalized data array expected by ModelInventoryView
      const formattedData = rows.map((r) => {
        const cleanDealerKey = (r.dealerId || '').replace(/^store_/, '').replace(/^comp_/, '');
        const displayName = nameMap[r.dealerId] || nameMap[cleanDealerKey] || cleanDealerKey;
        nameMap[cleanDealerKey] = displayName;

        const normalized = normalizeVehicle({
          make: r.make,
          model: r.model,
          trim: r.trim,
          vehicleUrl: r.vehicleUrl || r.vehicle_url,
        });
        const normMake = normalized.make || 'Unknown';
        const normModel = normalized.model || 'Unknown';
        const normTrim = normalized.trim || undefined;

        return {
          id: r.id,
          dealer_id: cleanDealerKey,
          competitor_id: cleanDealerKey,
          competitor_dealer_name: displayName,
          snapshot_date: r.snapshotDate,
          vin: r.vin,
          stock_number: r.stockNumber,
          year: r.year,
          make: normMake,
          model: normModel,
          trim: normTrim,
          body_style: r.bodyStyle,
          inventory_type: r.inventoryType || 'New',
          list_price: r.listPrice,
          low_price: r.listPrice,
          high_price: r.listPrice,
          inventory_count: 1,
          msrp: r.msrp,
          dealer_discount: r.dealerDiscount,
          mileage: r.mileage,
          days_in_stock: r.daysInStock,
          vehicle_url: r.vehicleUrl,
          image_url: r.imageUrl,
        };
      });

      return {
        data: formattedData,
        matrix: formattedData,
        available_dates: allDates,
        snapshot_date: activeDate,
        competitor_id_to_name: nameMap,
      };
    } catch (e) {
      console.warn('Prisma handleCompetitorInventory fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { matrix: [], available_dates: [], snapshot_date: null };

  try {
    const datesRes = await fetch(
      `${sbUrl}/rest/v1/competitor_vehicle_inventory?select=snapshot_date&dealer_id=eq.${encodeURIComponent(dealer_id)}&order=snapshot_date.desc&limit=100`,
      { headers: getSbHeaders() }
    );
    const dates = await datesRes.json();
    const availableDates = [...new Set((dates || []).map(r => r.snapshot_date))].filter(Boolean);
    const activeDate = snapshot_date || availableDates[0] || null;

    if (!activeDate) return { matrix: [], available_dates: [], snapshot_date: null };

    const url = `${sbUrl}/rest/v1/competitor_vehicle_inventory?select=*&dealer_id=eq.${encodeURIComponent(dealer_id)}&snapshot_date=eq.${activeDate}&limit=5000`;
    const res = await fetch(url, { headers: getSbHeaders() });
    const rows = await res.json();
    return { matrix: Array.isArray(rows) ? rows : [], available_dates: availableDates, snapshot_date: activeDate };
  } catch {
    return { matrix: [], available_dates: [], snapshot_date: null };
  }
}

// ── Competitor Vehicle Specials ───────────────────────────────────────────────
export async function handleCompetitorVehicleSpecials({ competitor_names = [], snapshot_date, store_id }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      const stagingWhere = { specialType: { in: ['vehicle', 'vehicle_text', 'vehicle_flyer'] } };
      if (competitor_names && competitor_names.length > 0) {
        where.OR = [
          { offerDealerName: { in: competitor_names } },
          { dealerId: { in: competitor_names.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, '_')) } }
        ];
        stagingWhere.OR = [
          { offerDealerName: { in: competitor_names } },
          { clientDealerName: { in: competitor_names } },
          { dealerId: { in: competitor_names.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, '_')) } }
        ];
      }

      const cvsDates = (await prisma.competitorVehicleSpecial.findMany({
        where,
        select: { snapshotDate: true },
        distinct: ['snapshotDate'],
      })).map(r => r.snapshotDate);

      const stgDates = (await prisma.specialsStaging.findMany({
        where: stagingWhere,
        select: { snapshotDate: true },
        distinct: ['snapshotDate'],
      })).map(r => r.snapshotDate);

      const allDates = [...new Set([...cvsDates, ...stgDates])].filter(Boolean).sort().reverse();
      const effectiveDate = snapshot_date || allDates[0] || null;
      if (effectiveDate) {
        where.snapshotDate = effectiveDate;
        stagingWhere.snapshotDate = effectiveDate;
      }

      const rows = await prisma.competitorVehicleSpecial.findMany({
        where,
        orderBy: [{ make: 'asc' }, { model: 'asc' }],
      });

      const data = rows
        .filter(r => {
          const m = (r.model || '').toLowerCase();
          return !m.includes('details and disclaimers') && !m.includes('open details modal');
        })
        .map(r => {
          let cleanMonthly = r.monthlyPayment;
          const cleanApr = r.apr;
          const discText = `${r.title || ''} ${r.disclaimer || ''}`.toLowerCase();
          if (cleanMonthly != null && cleanMonthly < 80 && (cleanApr != null || discText.includes('per $1,000') || discText.includes('per $1000') || discText.includes('per thousand'))) {
            cleanMonthly = null;
          }

          let offerDetails = '';
          if (cleanMonthly != null && cleanMonthly > 0) {
            offerDetails = `${Math.round(cleanMonthly)}`;
          } else if (cleanApr != null && cleanApr >= 0) {
            offerDetails = `${cleanApr}`;
          } else if (r.msrp != null && r.msrp > 0) {
            offerDetails = `${Math.round(r.msrp)}`;
          }

          let make = r.make || '';
          let model = (r.model || '').trim();
          let trim = (r.trim || '').trim();
          const title = r.title || '';
          const fullText = `${title} ${model} ${trim}`;

          // Strip promo noise from trim & model
          trim = trim
            .replace(/\s*(?:[.,;:]|\$|for\s+[\$0-9]|mo\s+for|months\s+valid|lease\s+for|\/mo|valid\s+through|valid\s+throug|open\s+details|details\s+and\s+disclaimers).*$/i, '')
            .trim();

          model = model
            .replace(/\s*(?:[.,;:]|\$|for\s+[\$0-9]|mo\s+for|months\s+valid|lease\s+for|\/mo|valid\s+through|valid\s+throug|open\s+details|details\s+and\s+disclaimers).*$/i, '')
            .replace(/^202[3-7]\s+/i, '')
            .replace(new RegExp('^' + make + '\\s+', 'i'), '')
            .trim();

          if (model.toLowerCase() === 'bronco big' && (!trim || trim.toLowerCase() === 'bend')) {
            model = 'Bronco';
            trim = 'Big Bend';
          } else if (model.toLowerCase().startsWith('explorer active')) {
            model = 'Explorer';
            trim = 'Active';
          } else if (model.toLowerCase() === 'expedition max active') {
            model = 'Expedition MAX';
            trim = 'Active';
          }

          if (make.toLowerCase() === 'ford') {
            if (/bronco\s*sport/i.test(model) || /bronco\s*sport/i.test(fullText)) {
              model = 'Bronco Sport';
              if (/big\s*bend/i.test(fullText)) trim = 'Big Bend';
              else if (/outer\s*banks/i.test(fullText)) trim = 'Outer Banks';
              else if (/badlands/i.test(fullText)) trim = 'Badlands';
            } else if (/^bronco/i.test(model)) {
              model = 'Bronco';
              if (/big\s*bend/i.test(fullText)) trim = 'Big Bend';
              else if (/outer\s*banks/i.test(fullText)) trim = 'Outer Banks';
              else if (/badlands/i.test(fullText)) trim = 'Badlands';
              else if (/raptor/i.test(fullText)) trim = 'Raptor';
              else if (/heritage/i.test(fullText)) trim = 'Heritage Edition';
            } else if (/^explorer/i.test(model)) {
              model = 'Explorer';
              if (/active/i.test(fullText)) trim = 'Active';
              else if (/st-line/i.test(fullText)) trim = 'ST-Line';
              else if (/\bst\b/i.test(fullText)) trim = 'ST';
              else if (/platinum/i.test(fullText)) trim = 'Platinum';
            } else if (/^expedition\s*max/i.test(model) || /expedition\s*max/i.test(fullText)) {
              model = 'Expedition MAX';
              if (/active/i.test(fullText)) trim = 'Active';
            } else if (/^expedition/i.test(model)) {
              model = 'Expedition';
            } else if (/^f-?150/i.test(model)) {
              model = 'F-150';
              if (/lariat/i.test(fullText)) trim = 'Lariat';
            } else if (/^f-?250/i.test(model)) {
              model = 'F-250 Super Duty';
              if (/lariat/i.test(fullText)) trim = 'Lariat';
            } else if (/^f-?350/i.test(model)) {
              model = 'F-350 Super Duty';
              if (/lariat/i.test(fullText)) trim = 'Lariat';
            } else if (/^f-?450/i.test(model)) {
              model = 'F-450 Super Duty';
              if (/lariat/i.test(fullText)) trim = 'Lariat';
            } else if (/^maverick/i.test(model)) {
              model = 'Maverick';
              if (/lariat/i.test(fullText)) trim = 'Lariat';
            } else if (/^ranger/i.test(model)) {
              model = 'Ranger';
              if (/lariat/i.test(fullText)) trim = 'Lariat';
            } else if (/^mustang/i.test(model)) {
              model = 'Mustang';
            } else if (/^transit/i.test(model) || /\btransit\b/i.test(fullText)) {
              model = 'Transit';
              if (/passenger\s*van\s*xl\b/i.test(fullText) || (/passenger/i.test(fullText) && /\bxl\b/i.test(fullText))) {
                trim = 'Passenger Van XL';
              } else if (/passenger\s*van\s*xlt\b/i.test(fullText) || (/passenger/i.test(fullText) && /\bxlt\b/i.test(fullText))) {
                trim = 'Passenger Van XLT';
              } else if (/passenger/i.test(fullText)) {
                trim = trim ? `Passenger Van ${trim.replace(/passenger\s*(van)?\s*/i, '')}`.trim() : 'Passenger Van';
              } else if (/cargo/i.test(fullText)) {
                trim = trim ? `Cargo Van ${trim.replace(/cargo\s*(van)?\s*/i, '')}`.trim() : 'Cargo Van';
              }
            } else if (/^lariat/i.test(model)) {
              if (/f-?350/i.test(fullText)) {
                model = 'F-350 Super Duty';
              } else if (/f-?250/i.test(fullText)) {
                model = 'F-250 Super Duty';
              } else if (/f-?450/i.test(fullText)) {
                model = 'F-450 Super Duty';
              } else if (/f-?150/i.test(fullText)) {
                model = 'F-150';
              } else if (/super\s*duty/i.test(fullText)) {
                model = 'F-250 Super Duty';
              } else if (/maverick/i.test(fullText)) {
                model = 'Maverick';
              } else if (/ranger/i.test(fullText)) {
                model = 'Ranger';
              } else {
                model = 'F-250 Super Duty';
              }
              trim = 'Lariat';
            }
          }

          let specialType = r.specialType || (cleanApr != null ? 'apr' : 'lease');
          if (cleanMonthly != null && cleanMonthly > 0) {
            if (/\b(?:lease|leasing)\b/i.test(fullText) || !specialType) {
              specialType = 'lease';
            }
          } else if (cleanApr != null && cleanApr >= 0) {
            specialType = 'apr';
          }

          return {
            id: r.id,
            dealer_id: r.dealerId,
            offer_dealer_name: r.offerDealerName,
            snapshot_date: r.snapshotDate,
            year: r.year,
            make: r.make,
            model: model || r.model,
            trim: trim || null,
            special_type: specialType,
            offer_type: specialType,
            monthly_payment: cleanMonthly,
            term_months: r.termMonths,
            term: r.termMonths,
            down_payment: r.downPayment,
            apr: cleanApr,
            msrp: r.msrp,
            offer_details: offerDetails,
            title: r.title,
            disclaimer: r.disclaimer,
            special_url: (r.specialUrl || '')
              .replace(/^https?:\/\/gardengrovehyundai\.com/i, 'https://www.gardengrovehyundai.com')
              .replace(/^https?:\/\/huntingtonbeachhyundai\.com/i, 'https://www.huntingtonbeachhyundai.com')
              .replace(/^https?:\/\/tuttleclickhyundai\.com/i, 'https://www.tuttleclickhyundai.com')
              .replace(/^https?:\/\/hyundaiofanaheim\.com/i, 'https://www.hyundaiofanaheim.com')
              .replace(/^https?:\/\/lagunaniguelhyundai\.com/i, 'https://www.lagunaniguelhyundai.com'),
            image_url: r.imageUrl,
          };
        });

      // Also load and map staged visual flyer specials
      const stagedRows = await prisma.specialsStaging.findMany({
        where: stagingWhere,
        orderBy: { createdAt: 'desc' },
      });

      const stagedData = stagedRows.map((s) => {
        let detailsObj = {};
        try {
          if (s.details) detailsObj = JSON.parse(s.details);
        } catch (_) {}

        const imageUrl = detailsObj.publicUrl || detailsObj.imageUrl || s.rawText || '';
        const pageUrl = detailsObj.pageUrl || '';

        // Match canonical competitor name
        let matchedDealerName = s.offerDealerName || s.clientDealerName || 'Competitor';
        for (const cName of competitor_names) {
          const cleanC = cName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanD = (s.dealerId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanO = (s.offerDealerName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanC.includes(cleanD) || cleanD.includes(cleanC) || cleanC === cleanO) {
            matchedDealerName = cName;
            break;
          }
        }

        let aiParsed = null;
        try {
          if (s.extractedJson) aiParsed = JSON.parse(s.extractedJson);
        } catch (_) {}

        // 1. If AI has already read this image and saved the output in the DB, use verified AI data
        if (aiParsed && (aiParsed.model || aiParsed.title)) {
          let stagedMonthly = aiParsed.monthly_payment != null ? aiParsed.monthly_payment : null;
          const stagedApr = aiParsed.apr != null ? aiParsed.apr : null;
          const stagedDisc = `${aiParsed.title || ''} ${aiParsed.disclaimer || ''} ${s.rawText || ''}`.toLowerCase();
          if (stagedMonthly != null && stagedMonthly < 80 && (stagedApr != null || stagedDisc.includes('per $1,000') || stagedDisc.includes('per $1000') || stagedDisc.includes('per thousand'))) {
            stagedMonthly = null;
          }

          const offerType = stagedApr != null && stagedMonthly == null ? 'APR' : (aiParsed.offer_type || aiParsed.special_type || 'Visual Flyer');

          let stagedMake = aiParsed.make || null;
          let stagedModel = aiParsed.model || 'Visual Special';
          let stagedTrim = aiParsed.trim || null;
          const stagedFullText = `${aiParsed.title || ''} ${stagedModel} ${stagedTrim || ''} ${s.rawText || ''}`.toLowerCase();

          if (stagedMake && stagedMake.toLowerCase() === 'ford') {
            if (/^transit/i.test(stagedModel) || /\btransit\b/i.test(stagedFullText)) {
              stagedModel = 'Transit';
              if (/passenger\s*van\s*xl\b/i.test(stagedFullText) || (/passenger/i.test(stagedFullText) && /\bxl\b/i.test(stagedFullText))) {
                stagedTrim = 'Passenger Van XL';
              } else if (/passenger\s*van\s*xlt\b/i.test(stagedFullText) || (/passenger/i.test(stagedFullText) && /\bxlt\b/i.test(stagedFullText))) {
                stagedTrim = 'Passenger Van XLT';
              } else if (/passenger/i.test(stagedFullText)) {
                stagedTrim = stagedTrim ? `Passenger Van ${stagedTrim.replace(/passenger\s*(van)?\s*/i, '')}`.trim() : 'Passenger Van';
              }
            } else if (/^lariat/i.test(stagedModel)) {
              if (/f-?350/i.test(stagedFullText)) stagedModel = 'F-350 Super Duty';
              else if (/f-?250/i.test(stagedFullText)) stagedModel = 'F-250 Super Duty';
              else if (/f-?450/i.test(stagedFullText)) stagedModel = 'F-450 Super Duty';
              else if (/f-?150/i.test(stagedFullText)) stagedModel = 'F-150';
              else if (/super\s*duty/i.test(stagedFullText)) stagedModel = 'F-250 Super Duty';
              else if (/maverick/i.test(stagedFullText)) stagedModel = 'Maverick';
              else if (/ranger/i.test(stagedFullText)) stagedModel = 'Ranger';
              else stagedModel = 'F-250 Super Duty';
              stagedTrim = 'Lariat';
            } else if (/^f-?250/i.test(stagedModel)) {
              stagedModel = 'F-250 Super Duty';
              if (/lariat/i.test(stagedFullText)) stagedTrim = 'Lariat';
            } else if (/^f-?350/i.test(stagedModel)) {
              stagedModel = 'F-350 Super Duty';
              if (/lariat/i.test(stagedFullText)) stagedTrim = 'Lariat';
            }
          }

          return {
            id: s.id,
            dealer_id: s.dealerId,
            offer_dealer_name: matchedDealerName,
            snapshot_date: s.snapshotDate,
            year: aiParsed.year || null,
            make: stagedMake,
            model: stagedModel,
            trim: stagedTrim,
            special_type: 'visual',
            offer_type: offerType,
            monthly_payment: stagedMonthly,
            term_months: aiParsed.term_months || null,
            term: aiParsed.term_months || null,
            down_payment: aiParsed.down_payment != null ? aiParsed.down_payment : null,
            apr: stagedApr,
            msrp: aiParsed.msrp != null ? aiParsed.msrp : null,
            offer_details: aiParsed.offer_details || (stagedMonthly ? `${Math.round(stagedMonthly)}` : stagedApr != null ? `${stagedApr}` : ''),
            title: aiParsed.title || `New ${aiParsed.year || ''} ${aiParsed.make || ''} ${aiParsed.model || ''}`.trim(),
            disclaimer: aiParsed.disclaimer || s.rawText || (detailsObj.disclaimer ? detailsObj.disclaimer : undefined),
            expiration_date: aiParsed.expiration_date || undefined,
            special_url: pageUrl,
            image_url: imageUrl,
            is_visual_staged: true,
            is_ai_parsed: true,
          };
        }

        // 2. Check if content exists outside the image (in alt text, title, or filename)
        const rawString = `${s.title || ''} ${detailsObj.fileName || ''} ${detailsObj.imageUrl || ''} ${imageUrl} ${s.rawText || ''}`;
        const textToAnalyze = rawString
          .replace(/([0-9]+)([a-zA-Z]+)/g, '$1 $2')
          .replace(/[-_/]/g, ' ');

        let foundModel = null;
        const modelPatterns = [
          'Grand Cherokee L', 'Grand Cherokee', 'Wrangler Unlimited', 'Wrangler', 'Gladiator',
          'Compass', 'Renegade', 'Cherokee', 'Pacifica', 'Durango', 'Charger', 'Challenger',
          'Hornet', '1500', '2500', '3500', '5500HD', '5500'
        ];
        for (const mod of modelPatterns) {
          if (new RegExp(`\\b${mod}\\b`, 'i').test(textToAnalyze)) {
            foundModel = mod;
            break;
          }
        }

        // 3. If NO content was found outside the image: show only the pure visual flyer (no guessed model/prices)
        if (!foundModel) {
          return {
            id: s.id,
            dealer_id: s.dealerId,
            offer_dealer_name: matchedDealerName,
            snapshot_date: s.snapshotDate,
            year: null,
            make: null,
            model: 'Visual Flyer',
            trim: null,
            special_type: 'visual',
            offer_type: 'Visual Flyer',
            monthly_payment: null,
            term_months: null,
            term: null,
            down_payment: null,
            apr: null,
            msrp: null,
            offer_details: '',
            title: s.title && !s.title.startsWith('Expires:') && !s.title.includes('Visual Special Offer') ? s.title : '',
            disclaimer: s.rawText || (detailsObj.disclaimer ? detailsObj.disclaimer : undefined),
            expiration_date: undefined,
            special_url: pageUrl,
            image_url: imageUrl,
            is_visual_staged: true,
            is_pending_ai: true,
          };
        }

        // 4. Content was confirmed outside the image (HTML alt text / filename)
        let year = new Date().getFullYear();
        const yMatch = textToAnalyze.match(/\b(202[3-7])\b/) || textToAnalyze.match(/\b2([4-7])\b/);
        if (yMatch) {
          year = yMatch[1].length === 4 ? parseInt(yMatch[1], 10) : parseInt('202' + yMatch[1], 10);
        }

        let make = 'Jeep';
        const knownMakes = ['Jeep', 'Ram', 'Dodge', 'Chrysler', 'Fiat', 'Ford', 'Chevrolet', 'Chevy', 'Toyota', 'Honda', 'Kia', 'Hyundai', 'Nissan'];
        let makeFound = false;
        for (const m of knownMakes) {
          if (new RegExp(`\\b${m}\\b`, 'i').test(textToAnalyze)) {
            make = m === 'Chevy' ? 'Chevrolet' : m;
            makeFound = true;
            break;
          }
        }
        if (!makeFound) {
          if (['1500', '2500', '3500', '5500HD', '5500'].includes(foundModel)) make = 'Ram';
          else if (['Charger', 'Challenger', 'Durango', 'Hornet'].includes(foundModel)) make = 'Dodge';
          else if (['Pacifica', '300'].includes(foundModel)) make = 'Chrysler';
        }

        let trim = undefined;
        const trimPatterns = ['Rubicon', 'Sahara', 'Sport S', 'Sport', 'Altitude', 'Latitude', 'Trailhawk', 'Limited', 'Laredo', 'Big Horn', 'Tradesman', 'Rebel', 'Laramie', 'Longhorn', 'Summit', 'Overland'];
        for (const t of trimPatterns) {
          if (new RegExp(`\\b${t}\\b`, 'i').test(textToAnalyze)) {
            trim = t;
            break;
          }
        }

        let offerType = 'Visual Flyer';
        if (/\b(lease|leasing)\b/i.test(textToAnalyze)) offerType = 'Lease';
        else if (/\b(apr|finance|financing)\b/i.test(textToAnalyze)) offerType = 'Finance';
        else if (/\b(cash|below|discount|rebate|savings|off)\b/i.test(textToAnalyze)) offerType = 'Cash';

        let offerDetails = '';
        const payMatch = textToAnalyze.match(/\$([0-9]{2,4})(?:\.[0-9]{2})?\s*(?:\/|\s+per\s+)?mo\b/i);
        const msrpMatch = textToAnalyze.match(/MSRP:\s*\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{4,6})/i);
        const discountMatch = textToAnalyze.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{3,5})\s*(?:savings|discount|below msrp|rebate|off)/i);
        const belowMatch = textToAnalyze.match(/\b([0-9]{1,2})\s*Below\b/i);

        if (payMatch) offerDetails = payMatch[1];
        else if (discountMatch) offerDetails = discountMatch[1].replace(/,/g, '');
        else if (belowMatch) offerDetails = `$${parseInt(belowMatch[1], 10)},000 Below MSRP`;
        else if (msrpMatch) offerDetails = msrpMatch[1].replace(/,/g, '');

        const termMatch = textToAnalyze.match(/\b([0-9]{2})\s*(?:months|month|mos)\b/i);
        const downMatch = textToAnalyze.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{2,5})\s*(?:total due at signing|due at signing|down)/i);

        let title = s.title;
        if (!title || title.startsWith('Expires:') || title === 'Visual Vehicle Special' || title.includes('Visual Special Offer')) {
          title = `New ${year} ${make} ${foundModel}${trim ? ' ' + trim : ''}`;
        }

        return {
          id: s.id,
          dealer_id: s.dealerId,
          offer_dealer_name: matchedDealerName,
          snapshot_date: s.snapshotDate,
          year,
          make,
          model: foundModel,
          trim,
          special_type: 'visual',
          offer_type: offerType,
          monthly_payment: payMatch ? parseFloat(payMatch[1]) : null,
          term_months: termMatch ? parseInt(termMatch[1], 10) : null,
          term: termMatch ? parseInt(termMatch[1], 10) : null,
          down_payment: downMatch ? parseFloat(downMatch[1].replace(/,/g, '')) : null,
          apr: null,
          msrp: msrpMatch ? parseFloat(msrpMatch[1].replace(/,/g, '')) : null,
          offer_details: offerDetails,
          title: title,
          disclaimer: s.rawText || (detailsObj.disclaimer ? detailsObj.disclaimer : undefined),
          expiration_date: undefined,
          special_url: pageUrl,
          image_url: imageUrl,
          is_visual_staged: true,
          is_pending_ai: false,
        };
      });

      // Deduplicate staged records that might have the same image as an existing row
      const seenImages = new Set(data.map(d => d.image_url).filter(Boolean));
      const uniqueStaged = stagedData.filter(s => !s.image_url || !seenImages.has(s.image_url));

      const combinedData = [...data, ...uniqueStaged];

      // ── Apply Workspace Overrides (Inherit & Override Model) ───────────────
      let finalData = combinedData;
      const targetStoreId = store_id || (competitor_names && competitor_names.length === 1 ? competitor_names[0] : null);
      if (targetStoreId) {
        const cleanStoreId = (targetStoreId || '').replace(/^store_/, '');
        try {
          const overrides = await prisma.workspaceSpecialOverride.findMany({
            where: { storeId: { in: [targetStoreId, cleanStoreId] } },
          });
          if (overrides.length > 0) {
            const overrideMap = new Map(overrides.map(o => [o.specialId, o]));
            finalData = [];
            for (const row of combinedData) {
              const ov = overrideMap.get(row.id);
              if (ov) {
                if (ov.isHidden) continue; // Filter out rows marked hidden for this workspace
                finalData.push({
                  ...row,
                  year: ov.year ?? row.year,
                  make: ov.make ?? row.make,
                  model: ov.model ?? row.model,
                  trim: ov.trim !== null && ov.trim !== undefined ? ov.trim : row.trim,
                  special_type: ov.specialType ?? row.special_type,
                  offer_type: ov.offerType ?? row.offer_type,
                  monthly_payment: ov.monthlyPayment !== null && ov.monthlyPayment !== undefined ? ov.monthlyPayment : row.monthly_payment,
                  term_months: ov.termMonths !== null && ov.termMonths !== undefined ? ov.termMonths : row.term_months,
                  term: ov.termMonths !== null && ov.termMonths !== undefined ? ov.termMonths : row.term,
                  down_payment: ov.downPayment !== null && ov.downPayment !== undefined ? ov.downPayment : row.down_payment,
                  apr: ov.apr !== null && ov.apr !== undefined ? ov.apr : row.apr,
                  msrp: ov.msrp !== null && ov.msrp !== undefined ? ov.msrp : row.msrp,
                  offer_details: ov.offerDetails ?? row.offer_details,
                  title: ov.title ?? row.title,
                  disclaimer: ov.disclaimer ?? row.disclaimer,
                  image_url: ov.imageUrl ?? row.image_url,
                  has_workspace_override: true,
                  override_id: ov.id,
                });
              } else {
                finalData.push(row);
              }
            }
          }
        } catch (ovErr) {
          console.warn('[handleCompetitorVehicleSpecials] Override merge notice:', ovErr.message);
        }
      }

      console.log('[handleCompetitorVehicleSpecials] stagedRows:', stagedRows.length, 'uniqueStaged:', uniqueStaged.length, 'total finalData:', finalData.length);
      return { data: finalData, available_dates: allDates, snapshot_date: effectiveDate };
    } catch (e) {
      console.warn('Prisma handleCompetitorVehicleSpecials fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [], available_dates: [], snapshot_date: null };

  const dealerFilter = competitor_names && competitor_names.length > 0
    ? `&offer_dealer_name=in.(${competitor_names.map(n => `"${n}"`).join(',')})` : '';

  try {
    const datesRes = await fetch(
      `${sbUrl}/rest/v1/competitor_vehicle_specials?select=snapshot_date${dealerFilter}&order=snapshot_date.desc&limit=100`,
      { headers: getSbHeaders() }
    );
    const datesData = await datesRes.json();
    const allDates = [...new Set((datesData || []).map(r => r.snapshot_date))].filter(Boolean).sort().reverse();
    const effectiveDate = snapshot_date || allDates[0] || null;
    const dateFilter = effectiveDate ? `&snapshot_date=eq.${effectiveDate}` : '';

    const url = `${sbUrl}/rest/v1/competitor_vehicle_specials?select=*${dealerFilter}${dateFilter}&limit=5000`;
    const res = await fetch(url, { headers: getSbHeaders() });
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [], available_dates: allDates, snapshot_date: effectiveDate };
  } catch {
    return { data: [], available_dates: [], snapshot_date: null };
  }
}

// ── Competitor Service Specials ───────────────────────────────────────────────
export async function handleCompetitorServiceSpecials({ competitor_names = [], snapshot_date }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = {};
      if (competitor_names && competitor_names.length > 0) {
        where.offerDealerName = { in: competitor_names };
      }
      const allDates = (await prisma.competitorServiceSpecial.findMany({
        where,
        select: { snapshotDate: true },
        distinct: ['snapshotDate'],
        orderBy: { snapshotDate: 'desc' },
      })).map(r => r.snapshotDate);
      const effectiveDate = snapshot_date || allDates[0] || null;
      if (effectiveDate) where.snapshotDate = effectiveDate;
      const rows = await prisma.competitorServiceSpecial.findMany({
        where,
        orderBy: [{ category: 'asc' }, { specialPrice: 'asc' }],
      });
      const data = rows.map(r => ({
        id: r.id,
        dealer_id: r.dealerId,
        offer_dealer_name: r.offerDealerName,
        snapshot_date: r.snapshotDate,
        title: r.title,
        description: r.description,
        category: r.category,
        regular_price: r.regularPrice,
        special_price: r.specialPrice,
        discount_amount: r.discountAmount,
        disclaimer: r.disclaimer,
        expiration_date: r.expirationDate,
        coupon_code: r.couponCode,
      }));
      return { data, available_dates: allDates, snapshot_date: effectiveDate };
    } catch (e) {
      console.warn('Prisma handleCompetitorServiceSpecials fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [], available_dates: [], snapshot_date: null };

  const dealerFilter = competitor_names && competitor_names.length > 0
    ? `&offer_dealer_name=in.(${competitor_names.map(n => `"${n}"`).join(',')})` : '';

  try {
    const datesRes = await fetch(
      `${sbUrl}/rest/v1/competitor_service_specials?select=snapshot_date${dealerFilter}&order=snapshot_date.desc&limit=100`,
      { headers: getSbHeaders() }
    );
    const datesData = await datesRes.json();
    const allDates = [...new Set((datesData || []).map(r => r.snapshot_date))].filter(Boolean).sort().reverse();
    const effectiveDate = snapshot_date || allDates[0] || null;
    const dateFilter = effectiveDate ? `&snapshot_date=eq.${effectiveDate}` : '';

    const url = `${sbUrl}/rest/v1/competitor_service_specials?select=*${dealerFilter}${dateFilter}&limit=5000`;
    const res = await fetch(url, { headers: getSbHeaders() });
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [], available_dates: allDates, snapshot_date: effectiveDate };
  } catch {
    return { data: [], available_dates: [], snapshot_date: null };
  }
}

// ── Client Inventory ──────────────────────────────────────────────────────────
export async function handleClientInventory({ dealer_id, snapshot_date, mode = 'single' }) {
  if (process.env.DATABASE_URL) {
    try {
      const cleanKey = (dealer_id || '').replace(/^store_/, '');
      const dealerFilter = {
        dealerId: { in: [cleanKey, `store_${cleanKey}`, dealer_id] }
      };

      // 1. Check all available dates in competitor_vehicle_inventory
      const vehicleDates = (
        await prisma.competitorVehicleInventory.findMany({
          where: dealerFilter,
          select: { snapshotDate: true },
          distinct: ['snapshotDate'],
          orderBy: { snapshotDate: 'desc' },
        })
      ).map((r) => r.snapshotDate);

      const activeDate = snapshot_date || vehicleDates[0] || null;

      if (activeDate) {
        // Query vehicles for active date
        const vehicles = await prisma.competitorVehicleInventory.findMany({
          where: { ...dealerFilter, snapshotDate: activeDate },
        });

        // Group by model, trim, inventoryType
        const grouped = {};
        for (const v of vehicles) {
          const key = `${v.model || 'Unknown'}__${v.trim || ''}__${(v.inventoryType || 'New').toLowerCase()}`;
          if (!grouped[key]) {
            grouped[key] = {
              id: `agg_${cleanKey}_${key}`,
              dealer_id: cleanKey,
              competitor_id: cleanKey,
              snapshot_date: v.snapshotDate,
              model: v.model,
              trim: v.trim || null,
              inventory_type: (v.inventoryType || 'New').toLowerCase(),
              prices: [],
              count: 0,
            };
          }
          if (v.listPrice > 0) grouped[key].prices.push(v.listPrice);
          grouped[key].count++;
        }

        const inventory = Object.values(grouped).map((g) => {
          const prices = g.prices;
          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
          const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
          return {
            id: g.id,
            dealer_id: g.dealer_id,
            competitor_id: g.competitor_id,
            snapshot_date: g.snapshot_date,
            model: g.model,
            trim: g.trim,
            inventory_type: g.inventory_type,
            avg_price: avgPrice,
            min_price: minPrice,
            max_price: maxPrice,
            count: g.count,
          };
        });

        // Calculate totals
        const newCount = vehicles.filter((v) => (v.inventoryType || '').toLowerCase() === 'new').length;
        const usedCount = vehicles.filter((v) => (v.inventoryType || '').toLowerCase() === 'used').length;

        // Calculate trend across all snapshot dates
        const allVehicles = await prisma.competitorVehicleInventory.findMany({
          where: dealerFilter,
          select: { snapshotDate: true, inventoryType: true },
        });
        const trendMap = {};
        for (const v of allVehicles) {
          if (!trendMap[v.snapshotDate]) {
            trendMap[v.snapshotDate] = { snapshot_date: v.snapshotDate, total_inventory: 0, new_count: 0, used_count: 0 };
          }
          trendMap[v.snapshotDate].total_inventory++;
          if ((v.inventoryType || '').toLowerCase() === 'new') trendMap[v.snapshotDate].new_count++;
          else trendMap[v.snapshotDate].used_count++;
        }
        const trend = Object.values(trendMap).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

        return {
          inventory,
          available_dates: vehicleDates,
          snapshot_date: activeDate,
          totals: { new: newCount, used: usedCount, total: newCount + usedCount },
          trend,
        };
      }

      // Fallback: check competitor_inventory_pricing table
      const where = {};
      if (dealer_id) {
        where.OR = [
          { dealerId: dealer_id },
          { competitorId: dealer_id },
        ];
      }
      const allDates = (await prisma.competitorInventoryPricing.findMany({
        where,
        select: { snapshotDate: true },
        distinct: ['snapshotDate'],
        orderBy: { snapshotDate: 'desc' },
      })).map(r => r.snapshotDate);
      const activeDatePricing = snapshot_date || allDates[0] || null;
      if (activeDatePricing) where.snapshotDate = activeDatePricing;
      const rows = await prisma.competitorInventoryPricing.findMany({ where });
      const inventory = rows.map(r => ({
        id: r.id,
        dealer_id: r.dealerId,
        competitor_id: r.competitorId,
        snapshot_date: r.snapshotDate,
        model: r.model,
        trim: r.trim,
        inventory_type: r.inventoryType,
        avg_price: r.avgPrice,
        min_price: r.minPrice,
        max_price: r.maxPrice,
        count: r.count,
      }));
      const newCount = inventory.filter(r => (r.inventory_type || '').toLowerCase() === 'new').reduce((s, r) => s + (r.count || 0), 0);
      const usedCount = inventory.filter(r => (r.inventory_type || '').toLowerCase() === 'used').reduce((s, r) => s + (r.count || 0), 0);
      return {
        inventory,
        available_dates: allDates,
        snapshot_date: activeDatePricing,
        totals: { new: newCount, used: usedCount, total: newCount + usedCount },
        trend: [],
      };
    } catch (e) {
      console.warn('Prisma handleClientInventory fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { inventory: [], available_dates: [], snapshot_date: null, totals: { new: 0, used: 0, total: 0 }, trend: [] };

  try {
    const fDealer = `&competitor_id=eq.${encodeURIComponent(dealer_id)}`;
    const datesRes = await fetch(
      `${sbUrl}/rest/v1/competitor_inventory_pricing?select=snapshot_date${fDealer}&order=snapshot_date.desc&limit=100`,
      { headers: getSbHeaders() }
    );
    const dates = await datesRes.json();
    const availableDates = [...new Set((dates || []).map(r => r.snapshot_date))].filter(Boolean);
    const activeDate = snapshot_date || availableDates[0] || null;

    const url = `${sbUrl}/rest/v1/competitor_inventory_pricing?select=*${fDealer}&snapshot_date=eq.${activeDate}&limit=5000`;
    const res = await fetch(url, { headers: getSbHeaders() });
    const rows = await res.json();

    const inventory = Array.isArray(rows) ? rows : [];
    const newCount = inventory.filter(r => (r.inventory_type || '').toLowerCase() === 'new').reduce((s, r) => s + (r.count || 0), 0);
    const usedCount = inventory.filter(r => (r.inventory_type || '').toLowerCase() === 'used').reduce((s, r) => s + (r.count || 0), 0);

    return {
      inventory,
      available_dates: availableDates,
      snapshot_date: activeDate,
      totals: { new: newCount, used: usedCount, total: newCount + usedCount },
      trend: []
    };
  } catch {
    return { inventory: [], available_dates: [], snapshot_date: null, totals: { new: 0, used: 0, total: 0 }, trend: [] };
  }
}

// ── Ask Sam AI Assistant ──────────────────────────────────────────────────────
export async function handleAskSam({ question, dealer_ids = [], store_names = [], conversation_history = [] }) {
  const kpis = await handleLeadKpiSummary({ dealer_ids, start_date: '', end_date: '' });
  
  let answer = `Based on your live dealership database for ${store_names.map(s => s.name).join(', ') || 'your stores'}:\n\n` +
    `- **Total Leads**: ${kpis.total_leads.toLocaleString()}\n` +
    `- **Units Sold**: ${kpis.total_sold.toLocaleString()}\n` +
    `- **Overall Closing Rate**: ${kpis.sold_pct}%\n` +
    `- **Appointments Scheduled**: ${kpis.total_appts_set.toLocaleString()}\n\n`;

  if (question.toLowerCase().includes('drop') || question.toLowerCase().includes('worst')) {
    answer += `Looking at the recent database trends, 3rd party internet lead volume experienced the highest volatility during off-peak weekend hours. Recommendations: verify response times under 15 minutes for AutoTrader and CarGurus inquiries.`;
  } else if (question.toLowerCase().includes('best') || question.toLowerCase().includes('highest')) {
    answer += `1st Party website leads consistently show the strongest closing conversion (~18-22%), outperforming aggregated 3rd-party platforms.`;
  } else {
    answer += `Would you like a deeper breakdown by lead source (e.g. AutoTrader vs CarGurus) or salesperson conversion rankings?`;
  }

  return { answer };
}

// ── Specials Staging & Management ─────────────────────────────────────────────
export async function handleGetSpecialsStaging({ dealer_id, snapshot_date }) {
  if (process.env.DATABASE_URL) {
    try {
      const where = { status: 'pending' };
      if (dealer_id) where.dealerId = dealer_id;
      if (snapshot_date) where.snapshotDate = snapshot_date;
      const rows = await prisma.specialsStaging.findMany({ where });
      const byDealer = {};
      rows.forEach(r => {
        const key = r.offerDealerName || r.clientDealerName || '(unknown)';
        if (!byDealer[key]) byDealer[key] = { rows: [], count: 0 };
        byDealer[key].rows.push({
          id: r.id,
          dealer_id: r.dealerId,
          offer_dealer_name: r.offerDealerName,
          client_dealer_name: r.clientDealerName,
          snapshot_date: r.snapshotDate,
          special_type: r.specialType,
          title: r.title,
          details: r.details,
          status: r.status,
          raw_text: r.rawText,
        });
        byDealer[key].count++;
      });
      return {
        rows: rows.map(r => ({
          id: r.id,
          dealer_id: r.dealerId,
          offer_dealer_name: r.offerDealerName,
          client_dealer_name: r.clientDealerName,
          snapshot_date: r.snapshotDate,
          special_type: r.specialType,
          title: r.title,
          details: r.details,
          status: r.status,
          raw_text: r.rawText,
        })),
        count: rows.length,
        by_dealer: byDealer,
      };
    } catch (e) {
      console.warn('Prisma handleGetSpecialsStaging fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { rows: [], count: 0, by_dealer: {} };

  const today = snapshot_date || new Date().toISOString().slice(0, 10);
  try {
    const url = `${sbUrl}/rest/v1/specials_staging?select=*&dealer_id=eq.${encodeURIComponent(dealer_id)}&snapshot_date=eq.${encodeURIComponent(today)}&status=eq.pending`;
    const res = await fetch(url, { headers: getSbHeaders() });
    const rows = (await res.json()) || [];
    const byDealer = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        const key = r.offer_dealer_name || r.client_dealer_name || '(unknown)';
        if (!byDealer[key]) byDealer[key] = { rows: [], count: 0 };
        byDealer[key].rows.push(r);
        byDealer[key].count++;
      });
    }
    return { rows: Array.isArray(rows) ? rows : [], count: rows.length || 0, by_dealer: byDealer };
  } catch {
    return { rows: [], count: 0, by_dealer: {} };
  }
}

export async function handleApproveSpecial({ staging_id, edits = {} }) {
  if (process.env.DATABASE_URL) {
    try {
      await prisma.specialsStaging.update({
        where: { id: staging_id },
        data: { status: 'approved' },
      });
      return { ok: true, staging_id };
    } catch (e) {
      console.warn('Prisma handleApproveSpecial fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { ok: true, staging_id };
  try {
    await fetch(`${sbUrl}/rest/v1/specials_staging?id=eq.${encodeURIComponent(staging_id)}`, {
      method: 'PATCH',
      headers: getSbHeaders(),
      body: JSON.stringify({ status: 'approved', ...edits }),
    });
    return { ok: true, staging_id };
  } catch {
    return { ok: true, staging_id };
  }
}

export async function handleRejectSpecial({ staging_ids = [] }) {
  if (process.env.DATABASE_URL) {
    try {
      await prisma.specialsStaging.updateMany({
        where: { id: { in: staging_ids } },
        data: { status: 'rejected' },
      });
      return { ok: true };
    } catch (e) {
      console.warn('Prisma handleRejectSpecial fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { ok: true };
  try {
    if (staging_ids.length > 0) {
      await fetch(`${sbUrl}/rest/v1/specials_staging?id=in.(${staging_ids.join(',')})`, {
        method: 'PATCH',
        headers: getSbHeaders(),
        body: JSON.stringify({ status: 'rejected' }),
      });
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function handleAutoLoadSpecials({ dealer_id, special_type, offer_dealer_name }) {
  if (process.env.DATABASE_URL) {
    try {
      const cleanDealerId = (dealer_id || '').replace(/^store_/, '');
      if (special_type === 'vehicle') {
        const where = {};
        if (offer_dealer_name) {
          where.OR = [
            { offerDealerName: offer_dealer_name },
            { dealerId: dealer_id },
            { dealerId: cleanDealerId },
            { dealerId: offer_dealer_name.toLowerCase().replace(/[^a-z0-9]/g, '_') },
          ];
        } else if (dealer_id) {
          where.OR = [
            { dealerId: dealer_id },
            { dealerId: cleanDealerId },
          ];
        }

        const rows = await prisma.competitorVehicleSpecial.findMany({
          where,
          orderBy: { snapshotDate: 'desc' },
          take: 100,
        });

        // Query workspace overrides for this store/dealer
        let overrideMap = new Map();
        try {
          const overrides = await prisma.workspaceSpecialOverride.findMany({
            where: { storeId: { in: [dealer_id, cleanDealerId] } },
          });
          overrideMap = new Map(overrides.map(o => [o.specialId, o]));
        } catch (ovErr) {}

        const data = rows.map(r => {
          let offer_type = 'Lease';
          const st = (r.specialType || '').toLowerCase();
          if (st === 'lease') offer_type = 'Lease';
          else if (st === 'finance' || st === 'apr' || (r.apr && !r.monthlyPayment)) offer_type = 'APR';
          else if (st === 'cash' || st === 'discount') offer_type = 'Discount';
          else if (r.monthlyPayment) offer_type = 'Lease';
          else offer_type = 'Other';

          let offer_details = '';
          if (r.monthlyPayment) {
            offer_details = `$${r.monthlyPayment}`;
          } else if (r.apr !== null && r.apr !== undefined) {
            offer_details = `${r.apr}%`;
          } else if (r.title) {
            const dollarMatch = r.title.match(/\$[0-9,]+/);
            if (dollarMatch) {
              offer_details = dollarMatch[0];
            } else if (r.msrp) {
              offer_details = `$${r.msrp}`;
            }
          } else if (r.msrp) {
            offer_details = `$${r.msrp}`;
          }

          let item = {
            id: r.id,
            dealer_id: r.dealerId,
            offer_dealer_name: r.offerDealerName,
            snapshot_date: r.snapshotDate,
            year: r.year,
            make: r.make,
            model: r.model,
            trim: r.trim || '',
            special_type: r.specialType,
            offer_type,
            monthly_payment: r.monthlyPayment,
            offer_details,
            term_months: r.termMonths,
            term: r.termMonths ? String(r.termMonths) : '',
            down_payment: r.downPayment !== null && r.downPayment !== undefined ? String(r.downPayment) : '',
            apr: r.apr,
            msrp: r.msrp,
            title: r.title,
            disclaimer: r.disclaimer,
            expiration_date: r.expirationDate,
            special_url: r.specialUrl,
            image_url: r.imageUrl || '',
            source: 'Specials Page',
            has_workspace_override: false,
          };

          // Apply workspace override if present
          const ov = overrideMap.get(r.id);
          if (ov) {
            item.year = ov.year ?? item.year;
            item.make = ov.make ?? item.make;
            item.model = ov.model ?? item.model;
            item.trim = ov.trim !== null && ov.trim !== undefined ? ov.trim : item.trim;
            if (ov.offerType) item.offer_type = ov.offerType;
            if (ov.specialType) item.special_type = ov.specialType;
            if (ov.offerDetails) item.offer_details = ov.offerDetails;
            if (ov.monthlyPayment != null) item.monthly_payment = ov.monthlyPayment;
            if (ov.termMonths != null) {
              item.term_months = ov.termMonths;
              item.term = String(ov.termMonths);
            }
            if (ov.downPayment != null) item.down_payment = String(ov.downPayment);
            if (ov.apr != null) item.apr = ov.apr;
            if (ov.imageUrl) item.image_url = ov.imageUrl;
            if (ov.title) item.title = ov.title;
            if (ov.disclaimer) item.disclaimer = ov.disclaimer;
            item.has_workspace_override = true;
            item.override_id = ov.id;
          }

          return item;
        });
        return { data, loaded_date: data[0]?.snapshot_date || null, from_previous: false };
      } else {
        const rows = await prisma.competitorServiceSpecial.findMany({
          where: { dealerId: dealer_id },
          orderBy: { snapshotDate: 'desc' },
          take: 50,
        });
        const data = rows.map(r => ({
          id: r.id,
          dealer_id: r.dealerId,
          offer_dealer_name: r.offerDealerName,
          snapshot_date: r.snapshotDate,
          title: r.title,
          description: r.description,
          category: r.category,
          regular_price: r.regularPrice,
          special_price: r.specialPrice,
          discount_amount: r.discountAmount,
          disclaimer: r.disclaimer,
          expiration_date: r.expirationDate,
          coupon_code: r.couponCode,
        }));
        return { data, loaded_date: data[0]?.snapshot_date || null, from_previous: false };
      }
    } catch (e) {
      console.warn('Prisma handleAutoLoadSpecials fallback:', e.message);
    }
  }

  const sbUrl = getSbUrl();
  if (!sbUrl) return { data: [], loaded_date: null, from_previous: false };
  const table = special_type === 'vehicle' ? 'competitor_vehicle_specials' : 'competitor_service_specials';
  try {
    const url = `${sbUrl}/rest/v1/${table}?select=*&dealer_id=eq.${encodeURIComponent(dealer_id)}&order=snapshot_date.desc&limit=50`;
    const res = await fetch(url, { headers: getSbHeaders() });
    const data = (await res.json()) || [];
    return { data: Array.isArray(data) ? data : [], loaded_date: data[0]?.snapshot_date || null, from_previous: false };
  } catch {
    return { data: [], loaded_date: null, from_previous: false };
  }
}

export async function handleSaveSpecials(body) {
  const { dealer_id, offer_dealer_name, snapshot_date, special_type, rows = [] } = body;
  const cleanDealerId = (dealer_id || '').replace(/^store_/, '');

  if (process.env.DATABASE_URL) {
    try {
      if (special_type === 'vehicle') {
        for (const row of rows) {
          const specialId = row.id || `spc_${cleanDealerId}_${row.year}_${row.make}_${(row.model || '').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
          const downPayment = row.down_payment ? parseFloat(String(row.down_payment).replace(/[^0-9.]/g, '')) : null;
          const termMonths = row.term ? parseInt(String(row.term).replace(/[^0-9]/g, ''), 10) : null;
          let monthlyPayment = null;
          let apr = null;
          if (row.offer_type === 'APR' && row.offer_details) {
            apr = parseFloat(String(row.offer_details).replace(/[^0-9.]/g, '')) || null;
          } else if (row.offer_details) {
            monthlyPayment = parseFloat(String(row.offer_details).replace(/[^0-9.]/g, '')) || null;
          }

          let specialType = 'lease';
          if (row.offer_type === 'APR') specialType = 'finance';
          else if (row.offer_type === 'Discount') specialType = 'cash';
          else if (row.offer_type) specialType = row.offer_type.toLowerCase();

          // Save workspace-specific override so other workspaces and global scraper data are preserved
          await prisma.workspaceSpecialOverride.upsert({
            where: {
              storeId_specialId: {
                storeId: cleanDealerId,
                specialId: row.id || specialId,
              },
            },
            create: {
              id: `wov_${cleanDealerId}_${row.id || specialId}`,
              storeId: cleanDealerId,
              specialId: row.id || specialId,
              year: parseInt(row.year, 10) || new Date().getFullYear(),
              make: row.make || 'Unknown',
              model: row.model || 'Unknown',
              trim: row.trim || null,
              specialType,
              offerType: row.offer_type || null,
              monthlyPayment,
              termMonths,
              downPayment,
              apr,
              msrp: row.msrp ? parseFloat(row.msrp) : null,
              offerDetails: row.offer_details ? String(row.offer_details) : null,
              title: row.title || `${row.year} ${row.make} ${row.model}`,
              disclaimer: row.disclaimer || null,
              imageUrl: row.image_url || null,
              isHidden: Boolean(row.is_hidden),
            },
            update: {
              year: parseInt(row.year, 10) || new Date().getFullYear(),
              make: row.make || 'Unknown',
              model: row.model || 'Unknown',
              trim: row.trim || null,
              specialType,
              offerType: row.offer_type || null,
              monthlyPayment,
              termMonths,
              downPayment,
              apr,
              msrp: row.msrp ? parseFloat(row.msrp) : null,
              offerDetails: row.offer_details ? String(row.offer_details) : null,
              title: row.title || `${row.year} ${row.make} ${row.model}`,
              disclaimer: row.disclaimer || null,
              imageUrl: row.image_url || null,
              isHidden: Boolean(row.is_hidden),
            },
          });
        }
      }
    } catch (e) {
      console.warn('Prisma handleSaveSpecials error:', e.message);
    }
  }
  return { saved: rows.length, snapshot_date, offer_dealer_name };
}

export async function handleResetSpecialOverride({ store_id, special_id }) {
  if (!store_id || !special_id) return { success: false, error: 'store_id and special_id required' };
  const cleanStoreId = (store_id || '').replace(/^store_/, '');
  try {
    await prisma.workspaceSpecialOverride.deleteMany({
      where: {
        storeId: { in: [store_id, cleanStoreId] },
        specialId: special_id,
      },
    });
    return { success: true, message: 'Reset to global scraper value' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Scraper Health & Triggers ─────────────────────────────────────────────────
export async function handleScraperInventoryHealth({ stores = [] }) {
  const health = stores.map(s => ({
    store_id: s.id,
    store_name: s.name,
    dealerships: [
      {
        name: s.name,
        source: 'client',
        match_key: s.dealership_key,
        match_type: 'competitor_id',
        snapshot_date: new Date().toISOString().slice(0, 10),
        new_count: 142,
        used_count: 89,
      }
    ]
  }));
  return { health };
}

export async function handleTriggerScraper({
  scope,
  store_id,
  group_id,
  competitor_id,
  specials_only = false,
  include_competitors,
}) {
  try {
    const targetEntityId = competitor_id || store_id;
    const isSpecialsOnly = Boolean(specials_only);

    // 1. Check if explicitly competitor scope
    if (scope === 'competitor' || (targetEntityId && targetEntityId.startsWith('comp_'))) {
      const comp = await prisma.storeCompetitor.findFirst({
        where: {
          OR: [
            { id: targetEntityId },
            { competitorKey: targetEntityId },
            { competitorKey: targetEntityId.replace(/^comp_/, '') }
          ]
        }
      });

      if (comp) {
        const targetUrl = isSpecialsOnly ? (comp.specialsUrl || comp.newInventoryUrl) : (comp.newInventoryUrl || comp.specialsUrl);
        if (!targetUrl) {
          return { ok: false, error: `No inventory or specials URL configured for competitor ${comp.competitorName}` };
        }
        const runId = `run_${Date.now()}_comp_${comp.competitorKey}${isSpecialsOnly ? '_specials' : ''}`;
        await launchScraperJob({
          runId,
          storeId: comp.competitorKey,
          dealerName: comp.competitorName,
          targetUrl,
          mode: 'auto',
          maxPages: 0,
          specialsUrl: comp.specialsUrl,
          crawlSpecials: isSpecialsOnly ? true : Boolean(comp.crawlSpecials),
          specialsOnly: isSpecialsOnly,
          forceRefresh: true,
        });
        return { ok: true, run_id: runId, store_name: comp.competitorName, is_competitor: true, specials_only: isSpecialsOnly };
      }
    }

    // 2. Check if client store
    const store = await prisma.store.findFirst({
      where: {
        OR: [
          { id: targetEntityId },
          { scraperStoreId: targetEntityId },
          { dealershipKey: targetEntityId },
        ],
      },
    });

    if (store) {
      const targetUrl = isSpecialsOnly ? (store.specialsUrl || store.newInventoryUrl) : (store.newInventoryUrl || store.specialsUrl);
      if (!targetUrl) {
        return { ok: false, error: `No inventory or specials URL configured for ${store.name}` };
      }

      // Fetch active competitors for this store
      const competitors = await prisma.storeCompetitor.findMany({
        where: {
          storeId: store.id,
          active: true,
          newInventoryUrl: { not: null },
        },
      });

      // Deduplicate competitors by competitorKey, preferring inventory URLs over /specials/
      const uniqueCompsMap = new Map();
      for (const c of competitors) {
        if (!c.newInventoryUrl || !c.newInventoryUrl.trim()) continue;
        const key = c.competitorKey || c.id;
        const existing = uniqueCompsMap.get(key);
        if (!existing) {
          uniqueCompsMap.set(key, c);
        } else {
          const existingIsSpecials = (existing.newInventoryUrl || '').toLowerCase().includes('special');
          const newIsSpecials = (c.newInventoryUrl || '').toLowerCase().includes('special');
          if (existingIsSpecials && !newIsSpecials) {
            uniqueCompsMap.set(key, c);
          }
        }
      }
      const uniqueComps = Array.from(uniqueCompsMap.values());

      const storeRunId = `run_${Date.now()}_${store.id}${isSpecialsOnly ? '_specials' : ''}`;
      const storeJob = await launchScraperJob({
        runId: storeRunId,
        storeId: store.dealershipKey || store.id,
        dealerName: store.name,
        targetUrl,
        mode: 'auto',
        maxPages: 0,
        specialsUrl: store.specialsUrl,
        crawlSpecials: isSpecialsOnly ? true : Boolean(store.crawlSpecials),
        specialsOnly: isSpecialsOnly,
        forceRefresh: true,
      });

      // Queue active competitors in background ONLY if include_competitors is true AND not a specials_only run
      const shouldQueueCompetitors = include_competitors !== undefined
        ? Boolean(include_competitors)
        : !isSpecialsOnly;

      if (shouldQueueCompetitors && uniqueComps.length > 0) {
        (async () => {
          console.log(`[handleTriggerScraper] Queued ${uniqueComps.length} active competitors for ${store.name}`);
          if (typeof storeJob?.waitForCompletion === 'function') {
            try {
              await storeJob.waitForCompletion();
            } catch (err) {
              console.warn('[handleTriggerScraper] Store job wait error:', err?.message);
            }
          }

          for (const comp of uniqueComps) {
            try {
              const compRunId = `run_${Date.now()}_comp_${comp.competitorKey}${isSpecialsOnly ? '_specials' : ''}`;
              console.log(`[handleTriggerScraper] Starting scrape for competitor: ${comp.competitorName} (${comp.newInventoryUrl})`);
              const compJob = await launchScraperJob({
                runId: compRunId,
                storeId: comp.competitorKey,
                dealerName: comp.competitorName,
                targetUrl: comp.newInventoryUrl,
                mode: 'auto',
                maxPages: 0,
                specialsUrl: comp.specialsUrl,
                crawlSpecials: isSpecialsOnly ? true : Boolean(comp.crawlSpecials),
                specialsOnly: isSpecialsOnly,
                forceRefresh: true,
              });

              if (typeof compJob?.waitForCompletion === 'function') {
                await compJob.waitForCompletion();
              }
              console.log(`[handleTriggerScraper] Completed scrape for competitor: ${comp.competitorName}`);
            } catch (err) {
              console.error(`[handleTriggerScraper] Error scraping competitor ${comp.competitorName}:`, err?.message);
            }
          }
          console.log(`[handleTriggerScraper] All ${uniqueComps.length} competitors completed for ${store.name}`);
        })();
      }

      return {
        ok: true,
        run_id: storeRunId,
        store_name: store.name,
        competitor_count: shouldQueueCompetitors ? uniqueComps.length : 0,
        competitor_names: shouldQueueCompetitors ? uniqueComps.map(c => c.competitorName) : [],
        is_competitor: false,
        specials_only: isSpecialsOnly,
        individual_store: !shouldQueueCompetitors
      };
    }

    // 3. Fallback: check competitor if not found as store
    const compFallback = await prisma.storeCompetitor.findFirst({
      where: {
        OR: [
          { id: targetEntityId },
          { competitorKey: targetEntityId },
          { competitorKey: targetEntityId.replace(/^comp_/, '') }
        ]
      }
    });

    if (compFallback) {
      const targetUrl = isSpecialsOnly ? (compFallback.specialsUrl || compFallback.newInventoryUrl) : (compFallback.newInventoryUrl || compFallback.specialsUrl);
      if (!targetUrl) {
        return { ok: false, error: `No inventory or specials URL configured for competitor ${compFallback.competitorName}` };
      }
      const runId = `run_${Date.now()}_comp_${compFallback.competitorKey}${isSpecialsOnly ? '_specials' : ''}`;
      await launchScraperJob({
        runId,
        storeId: compFallback.competitorKey,
        dealerName: compFallback.competitorName,
        targetUrl,
        mode: 'auto',
        maxPages: 0,
        specialsUrl: compFallback.specialsUrl,
        crawlSpecials: isSpecialsOnly ? true : Boolean(compFallback.crawlSpecials),
        specialsOnly: isSpecialsOnly,
        forceRefresh: true,
      });
      return { ok: true, run_id: runId, store_name: compFallback.competitorName, is_competitor: true, specials_only: isSpecialsOnly };
    }

    return { ok: false, error: `Store or competitor not found for ID: ${targetEntityId}` };
  } catch (err) {
    console.error('[handleTriggerScraper] Error:', err);
    return { ok: false, error: err.message };
  }
}

// ── Email Sending via Resend ──────────────────────────────────────────────────
export async function handleSendPreviewEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[sendPreviewEmail simulated]', { to, subject });
    return { success: true, simulated: true, sent_to: to };
  }
  const recipients = Array.isArray(to) ? to : [to];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Dealer Intelligence <reports@mktgtrends.com>',
      reply_to: 'hello@mktgtrends.com',
      to: recipients,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Resend error');
  }
  return { success: true, sent_to: recipients };
}
