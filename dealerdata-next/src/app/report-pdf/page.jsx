'use client';
import { useRef, useState, useMemo } from 'react';
import { useDealer } from '@/lib/DealerContext';
import { useLeadKpiSummary, useDealerRanking, useVendorSummary, useLeadTypeBreakdown } from '@/lib/useAggregatedData';
import { useActivityData, useAppointmentSnapshots } from '@/lib/useSupabaseData';
import { getPeriodRange } from '@/components/dashboard/PerformanceKPIs';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subDays, startOfMonth, subMonths } from 'date-fns';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const fmt = (n) => (n ?? 0).toLocaleString();
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function buildGroupedRows(rawData, leadGroups) {
  if (!leadGroups || leadGroups.length === 0) {
    const map = {};
    rawData.forEach(r => {
      const src = r.lead_source || 'Unknown';
      if (!map[src]) map[src] = { source: src, goodLeads: 0, sold: 0 };
      map[src].goodLeads += r.total_leads;
      map[src].sold += r.total_sold;
    });
    return Object.values(map).map(row => ({
      ...row,
      soldPct: pct(row.sold, row.goodLeads),
    }));
  }
  const sourceToGroup = {};
  leadGroups.forEach(g => {
    const sources = g.raw_sources ? g.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : [];
    sources.forEach(s => { sourceToGroup[s] = g.group_name; });
  });
  const map = {};
  rawData.forEach(r => {
    const src = r.lead_source || 'Unknown';
    const groupName = sourceToGroup[src] || src;
    if (!map[groupName]) map[groupName] = { source: groupName, goodLeads: 0, sold: 0 };
    map[groupName].goodLeads += r.total_leads;
    map[groupName].sold += r.total_sold;
  });
  return Object.values(map).map(row => ({
    ...row,
    soldPct: pct(row.sold, row.goodLeads),
  }));
}

// ── Section components (print-optimized) ──────────────────────────

function ReportHeader({ title, subtitle, date }) {
  return (
    <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: 12, marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>{subtitle}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{title}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{date}</div>
    </div>
  );
}

function KPIBox({ label, value, delta, deltaSuffix = '' }) {
  const arrowColor = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#94a3b8';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return (
    <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{value}</div>
      {delta !== undefined && (
        <div style={{ fontSize: 10, color: arrowColor, fontWeight: 700, marginTop: 3 }}>
          {arrow} {Math.abs(delta).toLocaleString()}{deltaSuffix} VS LAST MO
        </div>
      )}
    </div>
  );
}

function MiniBreakdownTable({ title, rows }) {
  return (
    <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
          <span style={{ fontSize: 11, color: '#334155' }}>{r.label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{fmt(r.leads)}</span>
        </div>
      ))}
    </div>
  );
}

function ApptTrendBar({ dates, appointmentRows, storeNameMap, isGroup }) {
  if (!dates.length) return null;
  const maxCount = Math.max(...dates.map(d => appointmentRows.filter(a => a.appointment_date === d).length), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '12px 0', height: 80 }}>
      {dates.map(d => {
        const count = appointmentRows.filter(a => a.appointment_date === d).length;
        const barH = Math.max(4, Math.round((count / maxCount) * 60));
        return (
          <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>{count}</div>
            <div style={{ width: '100%', height: barH, background: '#3b82f6', borderRadius: '3px 3px 0 0' }} />
            <div style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center' }}>{format(new Date(d + 'T00:00:00'), 'M/d')}</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 12, marginTop: 24 }}>
      {children}
    </div>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr style={{ background: '#f1f5f9' }}>
        {cols.map((c, i) => (
          <th key={i} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, textAlign: c.right ? 'right' : 'left', whiteSpace: 'nowrap' }}>{c.label}</th>
        ))}
      </tr>
    </thead>
  );
}

function Tr({ cells, footer }) {
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', background: footer ? '#f8fafc' : 'white' }}>
      {cells.map((c, i) => (
        <td key={i} style={{ padding: '6px 10px', fontSize: 11, color: footer ? '#0f172a' : '#334155', textAlign: c.right ? 'right' : 'left', fontWeight: footer ? 700 : 400, whiteSpace: 'nowrap' }}>{c.v}</td>
      ))}
    </tr>
  );
}

function ReportTable({ cols, rows, footer }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <TableHead cols={cols} />
      <tbody>
        {rows.map((r, i) => <Tr key={i} cells={r} />)}
        {footer && <Tr cells={footer} footer />}
      </tbody>
    </table>
  );
}

function PageBreak() {
  return <div style={{ pageBreakAfter: 'always', height: 1 }} />;
}

// ── Main report document ──────────────────────────────────────────

function ReportDocument({ data, label, isGroup, reportDate }) {
  const { mtdKpi, yesterdayKpi, lastMonthKpi, dealerRanking, vendorRows, activityRows, appointmentRows, storeNameMap, leadTypeBreakdown } = data;

  const mtdClose = pct(mtdKpi?.total_sold, mtdKpi?.total_leads);
  const ydClose = pct(yesterdayKpi?.total_sold, yesterdayKpi?.total_leads);
  const lmClose = pct(lastMonthKpi?.total_sold, lastMonthKpi?.total_leads);

  const mtdLeadsDelta = (mtdKpi?.total_leads ?? 0) - (lastMonthKpi?.total_leads ?? 0);
  const mtdSoldDelta = (mtdKpi?.total_sold ?? 0) - (lastMonthKpi?.total_sold ?? 0);
  const mtdCloseDelta = mtdClose - lmClose;

  // Lead type breakdown from the breakdown data
  const upTypeMap = {}, inventoryMap = {}, partyMap = {};
  (leadTypeBreakdown || []).forEach(r => {
    const lt = r.lead_type || 'Unknown';
    if (!upTypeMap[lt]) upTypeMap[lt] = 0;
    upTypeMap[lt] += r.total_leads || 0;

    const inv = r.inventory_type || 'Unknown';
    if (!inventoryMap[inv]) inventoryMap[inv] = 0;
    inventoryMap[inv] += r.total_leads || 0;
  });

  // Derive party type from vendor rows (1st vs 3rd party using lead groups)
  const firstPartyLeads = vendorRows.filter(v => v.partyType === '1st Party').reduce((s, v) => s + v.goodLeads, 0);
  const thirdPartyLeads = vendorRows.filter(v => v.partyType === '3rd Party').reduce((s, v) => s + v.goodLeads, 0);
  const totalLeadsForParty = (mtdKpi?.total_leads || 0);

  const upTypeRows = Object.entries(upTypeMap).sort((a,b) => b[1]-a[1]).map(([label, leads]) => ({ label, leads }));
  const inventoryRows = Object.entries(inventoryMap).sort((a,b) => b[1]-a[1]).map(([label, leads]) => ({ label, leads }));

  // Appointments by date
  const uniqueApptDates = [...new Set(appointmentRows.map(a => a.appointment_date))].filter(Boolean).sort();

  // Activity aggregated by store (group) or by salesperson (store)
  // Fix: sum calls+emails+texts instead of relying on total_activity which may be 0
  const storeActivityMap = {};
  activityRows.forEach(r => {
    const key = isGroup ? (r.dealer_id || '') : (r.salesperson || r.salesperson_name || '');
    const name = isGroup ? (storeNameMap[r.dealer_id] || r.dealer_id || key) : key;
    if (!storeActivityMap[key]) storeActivityMap[key] = { name, calls: 0, emails: 0, texts: 0, total: 0 };
    const calls = r.calls || 0;
    const emails = r.emails || 0;
    const texts = r.texts || 0;
    storeActivityMap[key].calls += calls;
    storeActivityMap[key].emails += emails;
    storeActivityMap[key].texts += texts;
    storeActivityMap[key].total += (r.total_activity || 0) || (calls + emails + texts);
  });
  const activityTableRows = Object.values(storeActivityMap).filter(r => r.name).sort((a, b) => b.total - a.total);

  // Vendor top/bottom
  const vendorSorted = [...vendorRows].sort((a, b) => b.sold - a.sold);
  const top3 = vendorSorted.slice(0, 3);
  const bottom3 = vendorSorted.slice(-3).reverse();

  // Dealer ranking sorted
  const rankingSorted = [...dealerRanking].sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0));

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#0f172a', background: 'white' }}>

      {/* ── PAGE 1: Lead Performance ── */}
      <div style={{ padding: '36px 40px', minHeight: 1050 }}>
        <ReportHeader title="Lead Performance" subtitle={label} date={reportDate} />

        <SectionTitle>Yesterday</SectionTitle>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <KPIBox label="Yesterday Leads" value={fmt(yesterdayKpi?.total_leads)} />
          <KPIBox label="Yesterday Sold" value={fmt(yesterdayKpi?.total_sold)} />
          <KPIBox label="Yesterday Sold %" value={`${ydClose}%`} />
        </div>

        <SectionTitle>Month-to-Date</SectionTitle>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <KPIBox label="MTD Leads" value={fmt(mtdKpi?.total_leads)} delta={mtdLeadsDelta} />
          <KPIBox label="MTD Sold" value={fmt(mtdKpi?.total_sold)} delta={mtdSoldDelta} />
          <KPIBox label="MTD Sold %" value={`${mtdClose}%`} delta={mtdCloseDelta} deltaSuffix="%" />
        </div>

        {(upTypeRows.length > 0 || inventoryRows.length > 0) && (
          <>
            <SectionTitle>Lead Type Breakdown (MTD)</SectionTitle>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {upTypeRows.length > 0 && <MiniBreakdownTable title="Up Type" rows={upTypeRows} />}
              {inventoryRows.length > 0 && <MiniBreakdownTable title="New vs Used" rows={inventoryRows} />}
              <MiniBreakdownTable title="Party Type" rows={[
                { label: '1st Party', leads: firstPartyLeads || Math.round(totalLeadsForParty * 0) },
                { label: '3rd Party', leads: thirdPartyLeads || totalLeadsForParty },
              ]} />
            </div>
          </>
        )}

        {isGroup && rankingSorted.length > 0 && (
          <>
            <SectionTitle>Dealership Ranking (MTD)</SectionTitle>
            <ReportTable
              cols={[{ label: 'Dealership' }, { label: 'Leads', right: true }, { label: 'Sold', right: true }, { label: 'Sold %', right: true }]}
              rows={rankingSorted.map((r, i) => [
                { v: `${i < 3 ? ['🥇','🥈','🥉'][i] + ' ' : ''}${storeNameMap[r.dealer_id] || r.dealer_id}` },
                { v: fmt(r.total_leads), right: true },
                { v: fmt(r.total_sold), right: true },
                { v: `${r.sold_pct || 0}%`, right: true },
              ])}
            />
          </>
        )}
      </div>

      <PageBreak />

      {/* ── PAGE 2: Appointments ── */}
      <div style={{ padding: '36px 40px', minHeight: 1050 }}>
        <ReportHeader title="Appointments" subtitle={label} date={reportDate} />

        {uniqueApptDates.length > 0 && (
          <>
            <SectionTitle>Appointments Trend</SectionTitle>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
              <ApptTrendBar dates={uniqueApptDates} appointmentRows={appointmentRows} storeNameMap={storeNameMap} isGroup={isGroup} />
            </div>
          </>
        )}

        <SectionTitle>Upcoming Appointments by Date</SectionTitle>
        {uniqueApptDates.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 12, padding: '20px 0' }}>No appointment data available.</div>
        ) : isGroup ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1 }}>Store</th>
                <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 }}>Total</th>
                {uniqueApptDates.map(d => (
                  <th key={d} style={{ padding: '7px 6px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'right', textTransform: 'uppercase' }}>
                    {format(new Date(d + 'T00:00:00'), 'M/d')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(
                appointmentRows.reduce((acc, a) => {
                  const key = a.dealer_id;
                  if (!acc[key]) acc[key] = { name: storeNameMap[key] || key, total: 0, byDate: {} };
                  acc[key].total++;
                  acc[key].byDate[a.appointment_date] = (acc[key].byDate[a.appointment_date] || 0) + 1;
                  return acc;
                }, {})
              ).map((store, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', fontSize: 11, color: '#334155' }}>{store.name}</td>
                  <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>{store.total}</td>
                  {uniqueApptDates.map(d => (
                    <td key={d} style={{ padding: '6px 6px', fontSize: 11, color: '#64748b', textAlign: 'right' }}>{store.byDate[d] || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1 }}>Date</th>
                <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 }}>Appointments</th>
              </tr>
            </thead>
            <tbody>
              {uniqueApptDates.map((d, i) => {
                const count = appointmentRows.filter(a => a.appointment_date === d).length;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 10px', fontSize: 11, color: '#334155' }}>{format(new Date(d + 'T00:00:00'), 'MMM d, yyyy')}</td>
                    <td style={{ padding: '6px 10px', fontSize: 11, color: '#0f172a', textAlign: 'right', fontWeight: 600 }}>{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <PageBreak />

      {/* ── PAGE 3: Salesperson Activity ── */}
      <div style={{ padding: '36px 40px', minHeight: 1050 }}>
        <ReportHeader title="Salesperson Activity" subtitle={label} date={reportDate} />

        <SectionTitle>{isGroup ? 'Activity by Dealership (Yesterday)' : 'Salesperson Activity (MTD)'}</SectionTitle>
        <ReportTable
          cols={[
            { label: isGroup ? 'Dealership' : 'Salesperson' },
            { label: 'Total', right: true },
            { label: 'Calls', right: true },
            { label: 'Emails', right: true },
            { label: 'Texts', right: true },
          ]}
          rows={activityTableRows.map(r => [
            { v: r.name },
            { v: fmt(r.total), right: true },
            { v: fmt(r.calls), right: true },
            { v: fmt(r.emails), right: true },
            { v: fmt(r.texts), right: true },
          ])}
          footer={activityTableRows.length > 0 ? [
            { v: 'Total' },
            { v: fmt(activityTableRows.reduce((s, r) => s + r.total, 0)), right: true },
            { v: fmt(activityTableRows.reduce((s, r) => s + r.calls, 0)), right: true },
            { v: fmt(activityTableRows.reduce((s, r) => s + r.emails, 0)), right: true },
            { v: fmt(activityTableRows.reduce((s, r) => s + r.texts, 0)), right: true },
          ] : null}
        />
      </div>

      <PageBreak />

      {/* ── PAGE 4: Vendor Performance ── */}
      <div style={{ padding: '36px 40px', minHeight: 1050 }}>
        <ReportHeader title="Vendor Performance" subtitle={label} date={reportDate} />

        <SectionTitle>All Vendors (MTD)</SectionTitle>
        <ReportTable
          cols={[{ label: 'Lead Source' }, { label: 'Leads', right: true }, { label: 'Sold', right: true }, { label: 'Sold %', right: true }]}
          rows={vendorSorted.map(v => [
            { v: v.source },
            { v: fmt(v.goodLeads), right: true },
            { v: fmt(v.sold), right: true },
            { v: `${v.soldPct}%`, right: true },
          ])}
          footer={vendorSorted.length > 0 ? [
            { v: 'Total' },
            { v: fmt(vendorSorted.reduce((s, r) => s + r.goodLeads, 0)), right: true },
            { v: fmt(vendorSorted.reduce((s, r) => s + r.sold, 0)), right: true },
            { v: `${pct(vendorSorted.reduce((s, r) => s + r.sold, 0), vendorSorted.reduce((s, r) => s + r.goodLeads, 0))}%`, right: true },
          ] : null}
        />

        {(top3.length > 0 || bottom3.length > 0) && (
          <>
            <div style={{ display: 'flex', gap: 24, marginTop: 28 }}>
              <div style={{ flex: 1 }}>
                <SectionTitle>Top 3 Vendors (by Sold)</SectionTitle>
                <ReportTable
                  cols={[{ label: 'Vendor' }, { label: 'Leads', right: true }, { label: 'Sold', right: true }, { label: 'Sold %', right: true }]}
                  rows={top3.map((v, i) => [
                    { v: `${['🥇','🥈','🥉'][i]} ${v.source}` },
                    { v: fmt(v.goodLeads), right: true },
                    { v: fmt(v.sold), right: true },
                    { v: `${v.soldPct}%`, right: true },
                  ])}
                />
              </div>
              <div style={{ flex: 1 }}>
                <SectionTitle>Bottom 3 Vendors (by Sold)</SectionTitle>
                <ReportTable
                  cols={[{ label: 'Vendor' }, { label: 'Leads', right: true }, { label: 'Sold', right: true }, { label: 'Sold %', right: true }]}
                  rows={bottom3.map(v => [
                    { v: v.source },
                    { v: fmt(v.goodLeads), right: true },
                    { v: fmt(v.sold), right: true },
                    { v: `${v.soldPct}%`, right: true },
                  ])}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function ReportPDF() {
  const { selectedLabel, selectedType, activeStores, activeDealershipKeys } = useDealer();
  const isGroup = selectedType === 'group';
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const enabled = activeDealershipKeys.length > 0;
  const { start: mtdStart, end: mtdEnd } = getPeriodRange('mtd');
  const { start: ydStart, end: ydEnd } = getPeriodRange('yesterday');
  // Last month same-day range for deltas
  const lmStart = format(subMonths(new Date(mtdStart + 'T00:00:00'), 1), 'yyyy-MM-dd');
  const lmEnd = format(subDays(new Date(mtdStart + 'T00:00:00'), 1), 'yyyy-MM-dd');

  const storeIds = activeStores.map(s => s.id);
  const { data: allLeadGroups = [] } = useQuery({
    queryKey: ['internetLeadGroups_all', storeIds.join(',')],
    enabled: storeIds.length > 0,
    queryFn: () => Promise.all(
      storeIds.map(id => base44.entities.InternetLeadGroup.filter({ store_id: id }, 'sort_order', 200))
    ).then(results => results.flat()),
  });

  const { data: mtdKpi } = useLeadKpiSummary(activeDealershipKeys, mtdStart, mtdEnd, enabled);
  const { data: yesterdayKpi } = useLeadKpiSummary(activeDealershipKeys, ydStart, ydEnd, enabled);
  const { data: lastMonthKpi } = useLeadKpiSummary(activeDealershipKeys, lmStart, lmEnd, enabled);
  const { data: dealerRanking = [] } = useDealerRanking(activeDealershipKeys, mtdStart, mtdEnd, enabled && isGroup);
  const { data: rawVendorData = [] } = useVendorSummary(activeDealershipKeys, mtdStart, mtdEnd, enabled);
  const { data: leadTypeBreakdown = [] } = useLeadTypeBreakdown(activeDealershipKeys, mtdStart, mtdEnd, enabled);
  const { data: activityRows = [] } = useActivityData(activeDealershipKeys, isGroup ? 'yesterday' : 'mtd', enabled);
  const { data: apptResult = { data: [] } } = useAppointmentSnapshots(activeDealershipKeys, enabled);

  const vendorRows = useMemo(() => buildGroupedRows(rawVendorData, allLeadGroups), [rawVendorData, allLeadGroups]);

  const storeNameMap = {};
  activeStores.forEach(s => { storeNameMap[s.dealership_key] = s.name; });

  const reportDate = format(new Date(), 'MMMM d, yyyy');

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Split the tall canvas into pages
      const canvasH = canvas.height;
      const canvasW = canvas.width;
      const ratio = pageW / canvasW;
      const scaledPageH = pageH / ratio;

      let y = 0;
      let pageIndex = 0;
      while (y < canvasH) {
        if (pageIndex > 0) pdf.addPage();
        const sliceH = Math.min(scaledPageH, canvasH - y);
        // Create a slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasW;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, y, canvasW, sliceH, 0, 0, canvasW, sliceH);
        const sliceData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceData, 'PNG', 0, 0, pageW, sliceH * ratio);
        y += scaledPageH;
        pageIndex++;
      }

      const filename = `${selectedLabel ? selectedLabel.replace(/\s+/g, '_') + '_' : ''}Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(filename);
    } finally {
      setGenerating(false);
    }
  };

  if (!selectedLabel) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm">Select a store or group to generate a report.</p>
      </div>
    );
  }

  const reportData = {
    mtdKpi,
    yesterdayKpi,
    lastMonthKpi,
    dealerRanking,
    vendorRows,
    leadTypeBreakdown,
    activityRows,
    appointmentRows: apptResult.data || [],
    storeNameMap,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">{selectedLabel} · {reportDate}</p>
        </div>
        <Button
          onClick={handleDownload}
          disabled={generating || !mtdKpi}
          className="gap-2 bg-slate-900 hover:bg-slate-800"
        >
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {generating ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>

      {/* Report preview */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div ref={reportRef} style={{ width: 816, background: 'white' }}>
          <ReportDocument
            data={reportData}
            label={selectedLabel}
            isGroup={isGroup}
            reportDate={reportDate}
          />
        </div>
      </div>
    </div>
  );
}