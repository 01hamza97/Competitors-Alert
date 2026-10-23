import { format, subDays, startOfMonth, getDate } from 'date-fns';

function nowPST() {
  const pstStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const [y, m, d] = pstStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getDateRanges() {
  const now = nowPST();
  const yesterday = subDays(now, 1);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const dayOfMonth = getDate(yesterday);

  return {
    yesterday: format(yesterday, 'yyyy-MM-dd'),
    currentYear,
    lastYear: currentYear - 1,
    mtdStart: format(startOfMonth(now), 'yyyy-MM-dd'),
    lyMtdStart: format(new Date(currentYear - 1, currentMonth, 1), 'yyyy-MM-dd'),
    lyEquivalentDate: format(new Date(currentYear - 1, currentMonth, dayOfMonth), 'yyyy-MM-dd'),
  };
}

export function sumField(records, field) {
  return records.reduce((s, r) => s + (r[field] || 0), 0);
}

export function filterMTD(records, year, start, end) {
  return records.filter(r => r.year === year && r.date >= start && r.date <= end);
}

export function computeTotals(records) {
  const li = sumField(records, 'leads_internet');
  const ls = sumField(records, 'leads_showroom');
  const lp = sumField(records, 'leads_phone');
  const si = sumField(records, 'sold_internet');
  const ss = sumField(records, 'sold_showroom');
  const sp = sumField(records, 'sold_phone');
  return {
    leads_internet: li, leads_showroom: ls, leads_phone: lp,
    sold_internet: si, sold_showroom: ss, sold_phone: sp,
    totalLeads: li + ls + lp,
    totalSold: si + ss + sp,
  };
}

export function groupByDealership(records) {
  return records.reduce((acc, r) => {
    if (!acc[r.dealership]) acc[r.dealership] = [];
    acc[r.dealership].push(r);
    return acc;
  }, {});
}

export function getDealerships(records) {
  return [...new Set(records.map(r => r.dealership))].sort();
}

export function closeRate(sold, leads) {
  if (!leads) return '—';
  return ((sold / leads) * 100).toFixed(1) + '%';
}