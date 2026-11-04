import { prisma } from './prisma.js';
import { normalizeVehicle } from './vehicleNormalization.js';
import {
  handleCompetitorSoldVehicles,
  handleCompetitorInventory,
  handleCompetitorVehicleSpecials,
} from './functionsBackend.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(num) {
  if (num == null || isNaN(num) || num <= 0) return null;
  return '$' + Math.round(num).toLocaleString();
}

/**
 * Builds the complete CompetiTracker Daily Snapshot HTML with live database data
 * for any given store.
 */
export async function buildCompetitorSnapshotHtml({
  storeId,
  storeKey,
  storeName,
  date,
  dashboardUrl = 'https://competitoralerts.ai',
  unsubscribeUrl,
}) {
  // 1. Locate store in DB
  let store = null;
  if (storeId) {
    store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { competitors: true },
    });
  }
  if (!store && (storeKey || storeName)) {
    store = await prisma.store.findFirst({
      where: {
        OR: [
          storeKey ? { dealershipKey: storeKey } : undefined,
          storeKey ? { dealershipKey: storeKey.replace(/^store_/, '') } : undefined,
          storeName ? { name: storeName } : undefined,
        ].filter(Boolean),
      },
      include: { competitors: true },
    });
  }

  if (!store) {
    throw new Error(`Store not found (id: ${storeId}, key: ${storeKey}, name: ${storeName})`);
  }

  const primaryName = store.name;
  const primaryKey = store.dealershipKey || store.id.replace(/^store_/, '');

  // 2. Identify dealers (Primary store first, then competitors)
  const dealers = [
    { key: primaryKey, name: primaryName, isPrimary: true },
  ];

  if (store.competitors && store.competitors.length > 0) {
    for (const c of store.competitors) {
      dealers.push({
        key: c.competitorKey,
        name: c.competitorName,
        isPrimary: false,
      });
    }
  }

  const competitorNames = dealers.map(d => d.name);

  // 3. Fetch Sold Vehicles Data
  let soldResult = null;
  try {
    soldResult = await handleCompetitorSoldVehicles({
      dealer_id: primaryKey,
      snapshot_date: date,
    });
  } catch (err) {
    console.warn('[EmailBuilder] Error fetching sold vehicles:', err.message);
  }

  const activeDate = soldResult?.snapshot_date || date || new Date().toISOString().split('T')[0];
  const soldRows = soldResult?.matrix || soldResult?.data || soldResult?.rows || [];

  // Group sold counts by model and dealer
  const soldByModel = {}; // { [model]: { [dealerKey]: count } }
  const soldTotals = {};  // { [dealerKey]: count }
  dealers.forEach(d => { soldTotals[d.key] = 0; });

  soldRows.forEach(r => {
    const model = (r.model || 'Other').trim();
    if (!soldByModel[model]) soldByModel[model] = {};
    const dKey = r.dealer_id || r.competitor_id;

    // Match dealer by key or name
    const matchedDealer = dealers.find(d =>
      d.key === dKey ||
      d.name === r.competitor_id ||
      d.key.replace(/^store_/, '') === String(dKey).replace(/^store_/, '')
    ) || dealers[0];

    const k = matchedDealer.key;
    soldByModel[model][k] = (soldByModel[model][k] || 0) + 1;
    soldTotals[k] = (soldTotals[k] || 0) + 1;
  });

  // 4. Fetch Inventory Data (Current & Prior Snapshot per dealer for deltas)
  const invByModel = {}; // { [model]: { [dealerKey]: { count: 0, lowPrice: null } } }
  const invTotals = {};  // { [dealerKey]: 0 }
  const priorInvByModel = {};
  const priorInvTotals = {};
  const hasPriorSnapshot = {}; // { [dealerKey]: boolean }
  dealers.forEach(d => {
    invTotals[d.key] = 0;
    priorInvTotals[d.key] = 0;
    hasPriorSnapshot[d.key] = false;
  });

  try {
    for (const d of dealers) {
      const cleanKey = d.key.replace(/^store_/, '').replace(/^comp_/, '');
      const dealerVariantIds = [...new Set([cleanKey, `store_${cleanKey}`, `comp_${cleanKey}`, d.key])].filter(Boolean);

      // Find current snapshot date for this dealer <= activeDate
      const currentSnap = await prisma.competitorVehicleInventory.findFirst({
        where: {
          dealerId: { in: dealerVariantIds },
          snapshotDate: { lte: activeDate },
        },
        orderBy: { snapshotDate: 'desc' },
        select: { snapshotDate: true },
      });

      if (!currentSnap) continue;
      const currentSnapDate = currentSnap.snapshotDate;

      // Fetch current snapshot rows deduplicated by VIN
      const currentRows = await prisma.competitorVehicleInventory.findMany({
        where: {
          dealerId: { in: dealerVariantIds },
          snapshotDate: currentSnapDate,
        },
        take: 5000,
      });

      const seenCurrentVins = new Set();
      for (const r of currentRows) {
        const vin = (r.vin || '').trim().toUpperCase();
        if (vin && seenCurrentVins.has(vin)) continue;
        if (vin) seenCurrentVins.add(vin);

        const norm = normalizeVehicle({
          make: r.make,
          model: r.model,
          trim: r.trim,
          vehicleUrl: r.vehicleUrl || r.vehicle_url,
        });
        const model = (norm.model || r.model || 'Other').trim();
        if (!invByModel[model]) invByModel[model] = {};
        if (!invByModel[model][d.key]) invByModel[model][d.key] = { count: 0, lowPrice: null };

        invByModel[model][d.key].count += 1;
        const low = r.listPrice != null && Number(r.listPrice) > 0 ? Number(r.listPrice) : null;
        if (low != null && (invByModel[model][d.key].lowPrice == null || low < invByModel[model][d.key].lowPrice)) {
          invByModel[model][d.key].lowPrice = low;
        }
        invTotals[d.key] = (invTotals[d.key] || 0) + 1;
      }

      // Find prior snapshot date strictly before currentSnapDate
      const priorSnap = await prisma.competitorVehicleInventory.findFirst({
        where: {
          dealerId: { in: dealerVariantIds },
          snapshotDate: { lt: currentSnapDate },
        },
        orderBy: { snapshotDate: 'desc' },
        select: { snapshotDate: true },
      });

      if (priorSnap?.snapshotDate) {
        hasPriorSnapshot[d.key] = true;
        const priorSnapDate = priorSnap.snapshotDate;

        const priorRows = await prisma.competitorVehicleInventory.findMany({
          where: {
            dealerId: { in: dealerVariantIds },
            snapshotDate: priorSnapDate,
          },
          take: 5000,
        });

        const seenPriorVins = new Set();
        for (const r of priorRows) {
          const vin = (r.vin || '').trim().toUpperCase();
          if (vin && seenPriorVins.has(vin)) continue;
          if (vin) seenPriorVins.add(vin);

          const norm = normalizeVehicle({
            make: r.make,
            model: r.model,
            trim: r.trim,
            vehicleUrl: r.vehicleUrl || r.vehicle_url,
          });
          const model = (norm.model || r.model || 'Other').trim();
          if (!priorInvByModel[model]) priorInvByModel[model] = {};
          if (!priorInvByModel[model][d.key]) priorInvByModel[model][d.key] = { count: 0, lowPrice: null };

          priorInvByModel[model][d.key].count += 1;
          const low = r.listPrice != null && Number(r.listPrice) > 0 ? Number(r.listPrice) : null;
          if (low != null && (priorInvByModel[model][d.key].lowPrice == null || low < priorInvByModel[model][d.key].lowPrice)) {
            priorInvByModel[model][d.key].lowPrice = low;
          }
          priorInvTotals[d.key] = (priorInvTotals[d.key] || 0) + 1;
        }
      }
    }
  } catch (err) {
    console.warn('[EmailBuilder] Error fetching inventory data:', err.message);
  }

  // 5. Fetch Specials Data
  let specialsRows = [];
  try {
    const specialsResult = await handleCompetitorVehicleSpecials({
      competitor_names: competitorNames,
      snapshot_date: activeDate,
      store_id: store.id,
    });
    specialsRows = specialsResult?.rows || specialsResult?.data || specialsResult?.specials || (Array.isArray(specialsResult) ? specialsResult : []);
  } catch (err) {
    console.warn('[EmailBuilder] Error fetching specials:', err.message);
  }

  // Group specials by model and dealer
  const specialsByModel = {};
  specialsRows.forEach(s => {
    const model = (s.model || 'Other').trim();
    if (!specialsByModel[model]) specialsByModel[model] = {};

    const matchedDealer = dealers.find(d =>
      d.name === s.competitor_id ||
      d.name === s.offer_dealer_name ||
      d.key === s.dealer_id
    );
    if (!matchedDealer) return;

    const k = matchedDealer.key;
    if (!specialsByModel[model][k]) {
      specialsByModel[model][k] = [];
    }
    specialsByModel[model][k].push(s);
  });

  // 6. Generate AI Summary bullet points
  const summaryBullets = [];

  // Bullet 1: Sold volume leader
  const sortedSellers = [...dealers].sort((a, b) => (soldTotals[b.key] || 0) - (soldTotals[a.key] || 0));
  if (sortedSellers[0] && soldTotals[sortedSellers[0].key] > 0) {
    const top = sortedSellers[0];
    summaryBullets.push(
      `<strong>${escapeHtml(top.name)}</strong> led estimated sales with <strong>${soldTotals[top.key]}</strong> new vehicles sold yesterday.`
    );
  } else {
    summaryBullets.push(`Tracking inventory velocity across all competitors.`);
  }

  // Bullet 2: Inventory shift
  const sortedInv = [...dealers].sort((a, b) => (invTotals[b.key] || 0) - (invTotals[a.key] || 0));
  const hasPrimaryPrior = hasPriorSnapshot[primaryKey];
  if (hasPrimaryPrior) {
    const primaryDelta = (invTotals[primaryKey] || 0) - (priorInvTotals[primaryKey] || 0);
    const deltaStr = primaryDelta > 0 ? `+${primaryDelta}` : `${primaryDelta}`;
    summaryBullets.push(
      `<strong>${escapeHtml(primaryName)}</strong> currently has <strong>${invTotals[primaryKey] || 0}</strong> new vehicles in stock (${deltaStr} vs prior snapshot).`
    );
  } else {
    summaryBullets.push(
      `<strong>${escapeHtml(primaryName)}</strong> currently has <strong>${invTotals[primaryKey] || 0}</strong> new vehicles in stock.`
    );
  }

  // Bullet 3: Price advantage
  let bestDealText = null;
  const modelsWithPrices = Object.keys(invByModel);
  for (const m of modelsWithPrices) {
    const row = invByModel[m];
    const prices = dealers.map(d => ({ name: d.name, key: d.key, price: row[d.key]?.lowPrice })).filter(x => x.price != null);
    if (prices.length >= 2) {
      prices.sort((a, b) => a.price - b.price);
      const lowest = prices[0];
      const highest = prices[prices.length - 1];
      const diff = highest.price - lowest.price;
      if (diff > 500) {
        bestDealText = `Lowest advertised price on <strong>${escapeHtml(m)}</strong> is <strong>$${lowest.price.toLocaleString()}</strong> at ${escapeHtml(lowest.name)} ($${diff.toLocaleString()} below high).`;
        break;
      }
    }
  }
  if (bestDealText) {
    summaryBullets.push(bestDealText);
  }

  // Bullet 4: New specials
  const newSpecials = specialsRows.filter(s => s.is_new_special || s.isNew);
  if (newSpecials.length > 0) {
    const ns = newSpecials[0];
    summaryBullets.push(
      `New special alert: <strong>${escapeHtml(ns.competitor_id || ns.offer_dealer_name)}</strong> published an offer on <strong>${escapeHtml(ns.model || 'New Vehicle')}</strong>.`
    );
  }

  // 7. Format Date for Header
  const formattedDate = new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const unsubUrl = unsubscribeUrl || `${dashboardUrl}/settings`;
  const storeParam = encodeURIComponent(primaryName);

  // All inventory models sorted by primary dealer inventory volume, then total volume
  const allInvModels = Object.keys(invByModel).sort((a, b) => {
    const primA = invByModel[a]?.[primaryKey]?.count || 0;
    const primB = invByModel[b]?.[primaryKey]?.count || 0;
    if (primB !== primA) return primB - primA;
    const totalA = dealers.reduce((s, d) => s + (invByModel[a]?.[d.key]?.count || 0), 0);
    const totalB = dealers.reduce((s, d) => s + (invByModel[b]?.[d.key]?.count || 0), 0);
    return totalB - totalA;
  });

  // All sold models sorted by primary dealer sold volume, then total sold
  const allSoldModels = Object.keys(soldByModel).sort((a, b) => {
    const primA = soldByModel[a]?.[primaryKey] || 0;
    const primB = soldByModel[b]?.[primaryKey] || 0;
    if (primB !== primA) return primB - primA;
    const totalA = dealers.reduce((s, d) => s + (soldByModel[a]?.[d.key] || 0), 0);
    const totalB = dealers.reduce((s, d) => s + (soldByModel[b]?.[d.key] || 0), 0);
    return totalB - totalA;
  });

  // 8. Assemble Full Responsive HTML
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(primaryName)} Competitor Snapshot | ${escapeHtml(formattedDate)}</title>
  <style>
    :root { color-scheme: light; }
    body { margin:0; padding:24px 12px; background:#f3f6fa; color:#172033; font-family:Arial,Helvetica,sans-serif; }
    table { border-collapse:collapse; }
    .wrap { width:100%; max-width:700px; margin:0 auto; background:#fff; border:1px solid #e3e9f0; border-radius:16px; overflow:hidden; }
    .top { padding:24px 30px; background:#14243b; color:#fff; }
    .brand { font-size:13px; font-weight:800; letter-spacing:1.7px; color:#86efac; text-transform:uppercase; }
    .brand span { color:#fff; }
    .top h1 { margin:18px 0 5px; font-size:24px; line-height:1.2; color:#ffffff; }
    .top p { margin:0; color:#cbd5e1; font-size:13px; line-height:1.6; }
    .body { padding:24px 30px 12px; }
    .section { margin:0 0 22px; border:1px solid #e5eaf0; border-radius:12px; overflow:hidden; }
    .section-head { padding:14px 16px; background:#fbfcfe; border-bottom:1px solid #e9edf2; }
    .section-head h2 { margin:0; font-size:16px; line-height:1.35; color:#172033; }
    .section-head p { margin:4px 0 0; font-size:11px; color:#64748b; line-height:1.45; }
    .section-content { padding:14px 16px 16px; }
    .summary { margin-bottom:22px; padding:17px 18px; border:1px solid #d8e8dc; border-left:4px solid #22a35a; border-radius:11px; background:#f5fbf6; }
    .summary-label { color:#168044; font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; }
    .summary ul { margin:8px 0 0; padding-left:18px; color:#273449; font-size:13px; line-height:1.6; }
    .totals { width:100%; margin:0 0 12px; }
    .totals td { padding:10px 6px; border:1px solid #e4eaf0; background:#f8fafc; text-align:center; }
    .totals strong { display:block; color:#16253a; font-size:19px; }
    .totals span { display:block; margin-top:3px; color:#69778a; font-size:9px; font-weight:700; letter-spacing:.2px; text-transform:uppercase; }
    .grid { width:100%; font-size:11px; }
    .grid th { padding:9px 7px; background:#f4f7fa; color:#64748b; font-size:9px; font-weight:800; letter-spacing:.35px; text-align:right; text-transform:uppercase; white-space:nowrap; }
    .grid th:first-child, .grid td:first-child { text-align:left; }
    .grid td { padding:9px 7px; border-bottom:1px solid #edf0f4; color:#263448; text-align:right; vertical-align:middle; }
    .grid tr:last-child td { border-bottom:0; }
    .grid .total-row td { background:#f6f9fc; font-weight:800; }
    .dealer { color:#17633a !important; font-weight:bold; }
    .delta { display:inline-block; margin-left:3px; font-size:10px; font-weight:800; white-space:nowrap; }
    .positive { color:#168044 !important; }
    .negative { color:#c43c3c !important; }
    .neutral { color:#778397 !important; }
    .price { display:block; font-weight:700; color:#1e293b; white-space:nowrap; }
    .price-change { display:block; margin-top:3px; font-size:10px; font-weight:800; white-space:nowrap; }
    .button-row { padding-top:14px; text-align:center; }
    .button { display:inline-block; padding:10px 18px; border-radius:7px; background:#2563eb; color:#ffffff !important; font-size:11px; font-weight:700; text-decoration:none; }
    .button.secondary { background:#2563eb; color:#ffffff !important; }
    .new-special { display:inline-block; margin-top:4px; padding:3px 6px; border-radius:12px; background:#fff0d8; color:#b45309; font-size:9px; font-weight:800; letter-spacing:.3px; text-transform:uppercase; white-space:nowrap; }
    .special-grid { width:100%; table-layout:fixed; font-size:10px; }
    .special-grid th { padding:9px 6px; text-align:left; vertical-align:bottom; white-space:normal; line-height:1.3; overflow-wrap:break-word; }
    .special-grid td { padding:10px 6px; vertical-align:top; text-align:left; line-height:1.45; overflow-wrap:break-word; }
    .special-grid td:first-child { font-weight:700; }
    .special-grid .new-cell { background:#fff8ed; }
    .footer { padding:18px 30px 23px; background:#f8fafc; border-top:1px solid #e7edf3; color:#758195; font-size:10px; line-height:1.6; text-align:center; }
    .footer a { color:#52637b; }
    @media only screen and (max-width:620px) {
      body { padding:0; background:#fff; }
      .wrap { border:0; border-radius:0; }
      .top { padding:22px 18px; }
      .top h1 { font-size:22px; }
      .body { padding:18px 12px 8px; }
      .section-head { padding:13px 12px; }
      .section-content { padding:12px 9px 14px; }
      .grid th, .grid td { padding:8px 4px; font-size:9px; }
      .grid th { font-size:8px; white-space:normal; }
      .delta, .price-change { font-size:9px; }
      .totals strong { font-size:17px; }
      .footer { padding:16px 18px 20px; }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <main class="wrap">
        <header class="top">
          <div class="brand">Competi<span>Tracker</span></div>
          <h1>${escapeHtml(primaryName)} Competitor Snapshot</h1>
          <p>${escapeHtml(formattedDate)}</p>
        </header>

        <div class="body">
          <!-- Summary -->
          <section class="summary">
            <div class="summary-label">Key Market Insights</div>
            <ul>
              ${summaryBullets.map(b => `<li>${b}</li>`).join('\n              ')}
            </ul>
          </section>

          <!-- 1. Sold Yesterday -->
          <section class="section">
            <div class="section-head">
              <h2>Sold Yesterday</h2>
              <p>Estimated from stock numbers or VINs removed from dealer websites.</p>
            </div>
            <div class="section-content">
              <table class="totals" role="presentation">
                <tr>
                  ${dealers.map(d => `<td><strong>${soldTotals[d.key] || 0}</strong><span>${escapeHtml(d.name)}</span></td>`).join('\n                  ')}
                </tr>
              </table>

              <table class="grid" role="presentation" width="100%">
                <thead>
                  <tr>
                    <th>Model</th>
                    ${dealers.map(d => `<th class="${d.isPrimary ? 'dealer' : ''}">${escapeHtml(d.name)}</th>`).join('\n                    ')}
                  </tr>
                </thead>
                <tbody>
                  <tr class="total-row">
                    <td>Total estimated</td>
                    ${dealers.map(d => `<td>${soldTotals[d.key] || 0}</td>`).join('\n                    ')}
                  </tr>
                  ${allSoldModels.map(model => `
                  <tr>
                    <td>${escapeHtml(model)}</td>
                    ${dealers.map(d => `<td>${soldByModel[model]?.[d.key] || 0}</td>`).join('\n                    ')}
                  </tr>`).join('')}
                </tbody>
              </table>

              <div class="button-row">
                <a class="button secondary" href="${dashboardUrl}/competitor-analysis?view=sold&amp;store=${storeParam}&amp;trim=true&amp;year=true&amp;date=${activeDate}">View year and trim breakdown</a>
              </div>
            </div>
          </section>

          <!-- 2. Inventory Changes -->
          <section class="section">
            <div class="section-head">
              <h2>Inventory Changes</h2>
              <p>Current listed count with change from previous snapshot.</p>
            </div>
            <div class="section-content">
              <table class="grid" role="presentation" width="100%">
                <thead>
                  <tr>
                    <th>Model</th>
                    ${dealers.map(d => `<th class="${d.isPrimary ? 'dealer' : ''}">${escapeHtml(d.name)}</th>`).join('\n                    ')}
                  </tr>
                </thead>
                <tbody>
                  <tr class="total-row">
                    <td>Total inventory</td>
                    ${dealers.map(d => {
                      const cur = invTotals[d.key] || 0;
                      const hasPrior = hasPriorSnapshot[d.key];
                      let diffBadge = '';
                      if (hasPrior) {
                        const prior = priorInvTotals[d.key] || 0;
                        const diff = cur - prior;
                        if (diff > 0) {
                          diffBadge = `<span class="delta positive">(+${diff})</span>`;
                        } else if (diff < 0) {
                          diffBadge = `<span class="delta negative">(${diff})</span>`;
                        }
                      }
                      return `<td>${cur} ${diffBadge}</td>`;
                    }).join('\n                    ')}
                  </tr>
                  ${allInvModels.map(model => `
                  <tr>
                    <td>${escapeHtml(model)}</td>
                    ${dealers.map(d => {
                      const cur = invByModel[model]?.[d.key]?.count || 0;
                      const hasPrior = hasPriorSnapshot[d.key];
                      let diffBadge = '';
                      if (hasPrior && cur > 0) {
                        const prior = priorInvByModel[model]?.[d.key]?.count || 0;
                        const diff = cur - prior;
                        if (diff > 0) {
                          diffBadge = `<span class="delta positive">(+${diff})</span>`;
                        } else if (diff < 0) {
                          diffBadge = `<span class="delta negative">(${diff})</span>`;
                        }
                      }
                      return `<td>${cur > 0 ? cur : '—'} ${cur > 0 ? diffBadge : ''}</td>`;
                    }).join('\n                    ')}
                  </tr>`).join('')}
                </tbody>
              </table>

              <div class="button-row">
                <a class="button" href="${dashboardUrl}/competitor-analysis?view=inventory&amp;store=${storeParam}&amp;date=${activeDate}">View inventory details</a>
              </div>
            </div>
          </section>

          <!-- 3. Model Pricing Changes -->
          <section class="section">
            <div class="section-head">
              <h2>Model Pricing Changes</h2>
              <p>Lowest advertised price with change from previous snapshot.</p>
            </div>
            <div class="section-content">
              <table class="grid" role="presentation" width="100%">
                <thead>
                  <tr>
                    <th>Model</th>
                    ${dealers.map(d => `<th class="${d.isPrimary ? 'dealer' : ''}">${escapeHtml(d.name)}</th>`).join('\n                    ')}
                  </tr>
                </thead>
                <tbody>
                  ${allInvModels.map(model => `
                  <tr>
                    <td>${escapeHtml(model)}</td>
                    ${dealers.map(d => {
                      const curPrice = invByModel[model]?.[d.key]?.lowPrice;
                      const hasPrior = hasPriorSnapshot[d.key];
                      const priorPrice = hasPrior ? priorInvByModel[model]?.[d.key]?.lowPrice : null;
                      if (!curPrice) return `<td><span class="neutral">—</span></td>`;
                      let changeHtml = '<span class="price-change neutral">—</span>';
                      if (hasPrior && priorPrice != null) {
                        const priceDiff = curPrice - priorPrice;
                        if (priceDiff < 0) {
                          changeHtml = `<span class="price-change positive">↓ $${Math.abs(priceDiff).toLocaleString()}</span>`;
                        } else if (priceDiff > 0) {
                          changeHtml = `<span class="price-change negative">↑ $${priceDiff.toLocaleString()}</span>`;
                        } else {
                          changeHtml = '<span class="price-change neutral">No change</span>';
                        }
                      }
                      return `<td><span class="price">$${curPrice.toLocaleString()}</span>${changeHtml}</td>`;
                    }).join('\n                    ')}
                  </tr>`).join('')}
                </tbody>
              </table>

              <div class="button-row">
                <a class="button secondary" href="${dashboardUrl}/competitor-analysis?view=inventory&amp;mode=all&amp;store=${storeParam}&amp;date=${activeDate}">View pricing details</a>
              </div>
            </div>
          </section>

          <!-- 4. Competitor Specials Changes -->
          <section class="section">
            <div class="section-head">
              <h2>Competitor Specials Changes</h2>
              <p>Current published lease and APR offers by model and dealership.</p>
            </div>
            <div class="section-content">
              <table class="grid special-grid" role="presentation" width="100%">
                <thead>
                  <tr>
                    <th>Model</th>
                    ${dealers.map(d => `<th class="${d.isPrimary ? 'dealer' : ''}">${escapeHtml(d.name)}</th>`).join('\n                    ')}
                  </tr>
                </thead>
                <tbody>
                  ${Object.keys(specialsByModel).length > 0
                    ? Object.keys(specialsByModel).slice(0, 8).map(model => `
                    <tr>
                      <td>${escapeHtml(model)}</td>
                      ${dealers.map(d => {
                        const offers = specialsByModel[model][d.key] || [];
                        if (offers.length === 0) return `<td><span class="neutral">No offer captured</span></td>`;
                        const first = offers[0];
                        const isNew = first.is_new_special || first.isNew;
                        const desc = first.offer_details || first.raw_text || first.title || 'Special offer';
                        return `<td class="${isNew ? 'new-cell' : ''}">
                          ${escapeHtml(desc)}
                          ${isNew ? '<br><span class="new-special">New Special</span>' : ''}
                        </td>`;
                      }).join('\n                      ')}
                    </tr>`).join('')
                    : `<tr><td colspan="${dealers.length + 1}" style="text-align:center;padding:18px;color:#94a3b8;">No current specials recorded for this date.</td></tr>`
                  }
                </tbody>
              </table>

              <div class="button-row">
                <a class="button" href="${dashboardUrl}/competitor-analysis?view=new_specials&amp;store=${storeParam}&amp;date=${activeDate}">View all specials</a>
              </div>
            </div>
          </section>
        </div>

        <footer class="footer">
          You are receiving this daily snapshot because you are subscribed to CompetiTracker for ${escapeHtml(primaryName)}.<br>
          <a href="${dashboardUrl}/competitor-analysis?store=${storeParam}">Open CompetiTracker</a> &nbsp;·&nbsp;
          <a href="${unsubUrl}">Manage email preferences</a>
        </footer>
      </main>
    </td></tr>
  </table>
</body>
</html>`;
}
