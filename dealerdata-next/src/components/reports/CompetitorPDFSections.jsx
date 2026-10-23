import { format } from 'date-fns';
import { normalizeMake, normalizeModel } from '@/lib/vehicleNormalization';

// ─── Layout constants ────────────────────────────────────────────────────────
const W = 900;          // SVG canvas width (px)
const MARGIN = 36;
const HEADER_H = 60;    // height reserved for page header
const ROW_H = 34;       // default data row height
const COL_LABEL_W = 160;
const FONT = 'Arial, Helvetica, sans-serif';

// ─── Colour helpers ──────────────────────────────────────────────────────────
function blueShadeInv(val, min, max) {
  if (val == null || max === 0 || min === max) return { bg: '#ffffff', text: '#111827' };
  const ratio = (val - min) / (max - min);
  const opacity = 0.08 + ratio * 0.82;
  return {
    bg: `rgba(59,130,246,${opacity.toFixed(2)})`,
    text: ratio > 0.55 ? '#ffffff' : '#1e3a5f',
  };
}
function blueShadePrice(val, min, max) {
  if (val == null || max === 0 || min === max) return { bg: '#ffffff', text: '#111827' };
  const ratio = 1 - (val - min) / (max - min);
  const opacity = 0.08 + ratio * 0.82;
  return {
    bg: `rgba(59,130,246,${opacity.toFixed(2)})`,
    text: ratio > 0.55 ? '#ffffff' : '#1e3a5f',
  };
}

const BADGE_COLORS = {
  lease:    { bg: '#ede9fe', text: '#6d28d9' },
  apr:      { bg: '#dbeafe', text: '#1d4ed8' },
  finance:  { bg: '#dbeafe', text: '#1d4ed8' },
  discount: { bg: '#d1fae5', text: '#065f46' },
  default:  { bg: '#f3f4f6', text: '#374151' },
};
function getBadge(type) {
  const t = (type || '').toLowerCase();
  for (const key of Object.keys(BADGE_COLORS)) if (t.includes(key)) return BADGE_COLORS[key];
  return BADGE_COLORS.default;
}

// ─── SVG primitives ──────────────────────────────────────────────────────────

/** Centred SVG text — the only text primitive we use */
function SvgText({ x, y, text, fontSize = 11, fontWeight = 'normal', fill = '#111827', anchor = 'middle', maxWidth }) {
  const str = text == null ? '' : String(text);
  // Truncate roughly by character count if maxWidth given (heuristic: ~6.5px per char at 11px)
  const charsPerPx = 6.5 * (fontSize / 11);
  const truncated = maxWidth && str.length * charsPerPx > maxWidth
    ? str.slice(0, Math.floor(maxWidth / charsPerPx) - 1) + '…'
    : str;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      alignmentBaseline="middle"
      fontSize={fontSize}
      fontWeight={fontWeight}
      fontFamily={FONT}
      fill={fill}
    >
      {truncated}
    </text>
  );
}

/** A pill badge — rect + centred text */
function SvgBadge({ x, y, label, badgeW = 60, badgeH = 16 }) {
  const b = getBadge(label);
  return (
    <g>
      <rect x={x} y={y} width={badgeW} height={badgeH} rx={badgeH / 2} fill={b.bg} />
      <SvgText
        x={x + badgeW / 2}
        y={y + badgeH / 2}
        text={(label || '').toUpperCase()}
        fontSize={8}
        fontWeight="700"
        fill={b.text}
        anchor="middle"
      />
    </g>
  );
}

/** Page header — title + subtitle line */
function SvgHeader({ storeName, title, date }) {
  const subtitle = `${storeName} — ${title}${date ? `   ·   Snapshot: ${format(new Date(date + 'T12:00:00'), 'MMMM d, yyyy')}` : ''}`;
  return (
    <g>
      <SvgText x={MARGIN} y={22} text="Competitive Analysis" fontSize={18} fontWeight="bold" fill="#111111" anchor="start" />
      <SvgText x={MARGIN} y={44} text={subtitle} fontSize={11} fill="#6b7280" anchor="start" />
      <line x1={MARGIN} y1={HEADER_H - 2} x2={W - MARGIN} y2={HEADER_H - 2} stroke="#e5e7eb" strokeWidth="1.5" />
    </g>
  );
}

// ─── Shared table helpers ────────────────────────────────────────────────────

function buildColWidths(colCount) {
  const remaining = W - MARGIN * 2 - COL_LABEL_W;
  const colW = Math.floor(remaining / colCount);
  return colW;
}

function SvgTableHeader({ columns, colW, startY }) {
  const rowH = 28;
  const y = startY;
  return (
    <g>
      <rect x={MARGIN} y={y} width={W - MARGIN * 2} height={rowH} fill="#f9fafb" />
      <SvgText x={MARGIN + 8} y={y + rowH / 2} text="MODEL" fontSize={9} fontWeight="700" fill="#9ca3af" anchor="start" />
      {columns.map((col, i) => (
        <SvgText
          key={col}
          x={MARGIN + COL_LABEL_W + i * colW + colW / 2}
          y={y + rowH / 2}
          text={col.toUpperCase()}
          fontSize={9}
          fontWeight="700"
          fill="#374151"
          anchor="middle"
          maxWidth={colW - 6}
        />
      ))}
      <line x1={MARGIN} y1={y + rowH} x2={W - MARGIN * 2 + MARGIN} y2={y + rowH} stroke="#e5e7eb" strokeWidth="1" />
    </g>
  );
}

// ─── 1. Inventory Count ──────────────────────────────────────────────────────

export function InventorySection({ storeName, data }) {
  const rows = data?.data || [];
  const activeDate = data?.snapshot_date;

  const competitors = [...new Set(rows.map(r => r.competitor_dealer_name))].sort();
  const modelMap = {};
  rows.forEach(r => {
    const model = normalizeModel(r.make, r.model);
    if (!modelMap[model]) modelMap[model] = {};
    const inv = r.inventory_count ?? 1;
    modelMap[model][r.competitor_dealer_name] = (modelMap[model][r.competitor_dealer_name] || 0) + inv;
  });
  const models = Object.keys(modelMap).sort();
  const colW = buildColWidths(competitors.length || 1);
  const tableHeaderY = HEADER_H + 4;
  const tableHeaderH = 28;
  const totalH = HEADER_H + 4 + tableHeaderH + models.length * ROW_H + 24;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={totalH} style={{ background: '#fff' }}>
      <SvgHeader storeName={storeName} title="Inventory Count" date={activeDate} />
      <SvgTableHeader columns={competitors} colW={colW} startY={tableHeaderY} />
      {models.map((model, i) => {
        const vals = competitors.map(d => modelMap[model][d]).filter(v => v != null);
        const rowMin = Math.min(...vals);
        const rowMax = Math.max(...vals);
        const rowY = tableHeaderY + tableHeaderH + i * ROW_H;
        const bg = i % 2 === 1 ? '#fafafa' : '#ffffff';
        return (
          <g key={model}>
            <rect x={MARGIN} y={rowY} width={W - MARGIN * 2} height={ROW_H} fill={bg} />
            <SvgText x={MARGIN + 8} y={rowY + ROW_H / 2} text={model} fontSize={11} fontWeight="500" fill="#111827" anchor="start" maxWidth={COL_LABEL_W - 12} />
            {competitors.map((d, ci) => {
              const val = modelMap[model][d];
              const c = val != null ? blueShadeInv(val, rowMin, rowMax) : { bg, text: '#9ca3af' };
              const cx = MARGIN + COL_LABEL_W + ci * colW;
              return (
                <g key={d}>
                  <rect x={cx} y={rowY} width={colW} height={ROW_H} fill={c.bg} />
                  {val != null && (
                    <SvgText x={cx + colW / 2} y={rowY + ROW_H / 2} text={val} fontSize={12} fontWeight="600" fill={c.text} anchor="middle" />
                  )}
                </g>
              );
            })}
            <line x1={MARGIN} y1={rowY + ROW_H} x2={W - MARGIN} y2={rowY + ROW_H} stroke="#f3f4f6" strokeWidth="1" />
          </g>
        );
      })}
      <SvgText x={MARGIN} y={totalH - 10} text="Blue intensity = inventory count (darker = more units)." fontSize={9} fill="#9ca3af" anchor="start" />
    </svg>
  );
}

// ─── 2. Low Price ────────────────────────────────────────────────────────────

export function LowPriceSection({ storeName, data }) {
  const rows = data?.data || [];
  const activeDate = data?.snapshot_date;

  const competitors = [...new Set(rows.map(r => r.competitor_dealer_name))].sort();
  const modelMap = {};
  rows.forEach(r => {
    const model = normalizeModel(r.make, r.model);
    if (!modelMap[model]) modelMap[model] = {};
    const prev = modelMap[model][r.competitor_dealer_name];
    const v = r.low_price;
    if (v != null) modelMap[model][r.competitor_dealer_name] = prev == null ? v : Math.min(prev, v);
  });
  const models = Object.keys(modelMap).sort();
  const colW = buildColWidths(competitors.length || 1);
  const tableHeaderY = HEADER_H + 4;
  const tableHeaderH = 28;
  const totalH = HEADER_H + 4 + tableHeaderH + models.length * ROW_H + 24;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={totalH} style={{ background: '#fff' }}>
      <SvgHeader storeName={storeName} title="Low Price" date={activeDate} />
      <SvgTableHeader columns={competitors} colW={colW} startY={tableHeaderY} />
      {models.map((model, i) => {
        const vals = competitors.map(d => modelMap[model][d]).filter(v => v != null);
        const rowMin = Math.min(...vals);
        const rowMax = Math.max(...vals);
        const rowY = tableHeaderY + tableHeaderH + i * ROW_H;
        const bg = i % 2 === 1 ? '#fafafa' : '#ffffff';
        return (
          <g key={model}>
            <rect x={MARGIN} y={rowY} width={W - MARGIN * 2} height={ROW_H} fill={bg} />
            <SvgText x={MARGIN + 8} y={rowY + ROW_H / 2} text={model} fontSize={11} fontWeight="500" fill="#111827" anchor="start" maxWidth={COL_LABEL_W - 12} />
            {competitors.map((d, ci) => {
              const val = modelMap[model][d];
              const c = val != null ? blueShadePrice(val, rowMin, rowMax) : { bg, text: '#9ca3af' };
              const cx = MARGIN + COL_LABEL_W + ci * colW;
              return (
                <g key={d}>
                  <rect x={cx} y={rowY} width={colW} height={ROW_H} fill={c.bg} />
                  {val != null && (
                    <SvgText x={cx + colW / 2} y={rowY + ROW_H / 2} text={`$${Number(val).toLocaleString()}`} fontSize={11} fontWeight="600" fill={c.text} anchor="middle" />
                  )}
                </g>
              );
            })}
            <line x1={MARGIN} y1={rowY + ROW_H} x2={W - MARGIN} y2={rowY + ROW_H} stroke="#f3f4f6" strokeWidth="1" />
          </g>
        );
      })}
      <SvgText x={MARGIN} y={totalH - 10} text="Darker blue = lowest price (best deal)." fontSize={9} fill="#9ca3af" anchor="start" />
    </svg>
  );
}

// ─── 3. New Vehicle Specials ─────────────────────────────────────────────────
// Each cell can contain multiple offer cards stacked vertically.
// Card height: badge(20) + value(18) + meta lines(14 each) + padding = dynamic

const CARD_BADGE_H = 18;
const CARD_VALUE_H = 20;
const CARD_META_H = 14;
const CARD_PAD = 6;
const CARD_GAP = 4;

function cardHeight(s) {
  let h = CARD_PAD;
  if (s.offer_type) h += CARD_BADGE_H + 3;
  if (s.offer_details) h += CARD_VALUE_H;
  if (s.term) h += CARD_META_H;
  if (s.down_payment != null) h += CARD_META_H;
  h += CARD_PAD;
  return Math.max(h, 36);
}

function cellHeight(items) {
  if (!items.length) return ROW_H;
  return items.reduce((acc, s) => acc + cardHeight(s) + CARD_GAP, CARD_GAP);
}

function formatOfferValue(offerDetails, offerType) {
  if (!offerDetails) return offerDetails;
  const t = (offerType || '').toLowerCase();
  const raw = String(offerDetails).trim();
  // Already has $ or % — don't double-add
  if (t.includes('lease') && !raw.startsWith('$')) return `$${raw}`;
  if ((t.includes('apr') || t.includes('financ')) && !raw.endsWith('%')) return `${raw}%`;
  return raw;
}

function SvgSpecialCard({ x, y, w, s }) {
  const b = getBadge(s.offer_type);
  const h = cardHeight(s);
  let cursor = y + CARD_PAD;
  const badgeW = Math.min(80, w - 16);
  const displayValue = formatOfferValue(s.offer_details, s.offer_type);

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.8" />
      {s.offer_type && (
        <>
          <SvgBadge x={x + CARD_PAD} y={cursor} label={s.offer_type} badgeW={badgeW} badgeH={CARD_BADGE_H} />
          {(() => { cursor += CARD_BADGE_H + 3; return null; })()}
        </>
      )}
      {displayValue && (
        <>
          <SvgText x={x + CARD_PAD} y={cursor + CARD_VALUE_H / 2} text={displayValue} fontSize={13} fontWeight="800" fill="#111111" anchor="start" maxWidth={w - CARD_PAD * 2} />
          {(() => { cursor += CARD_VALUE_H; return null; })()}
        </>
      )}
      {s.term && (
        <>
          <SvgText x={x + CARD_PAD} y={cursor + CARD_META_H / 2} text={`${s.term} months`} fontSize={9} fill="#6b7280" anchor="start" />
          {(() => { cursor += CARD_META_H; return null; })()}
        </>
      )}
      {s.down_payment != null && (
        <SvgText x={x + CARD_PAD} y={cursor + CARD_META_H / 2} text={`$${Number(s.down_payment).toLocaleString()} down`} fontSize={9} fill="#6b7280" anchor="start" />
      )}
    </g>
  );
}

export function NewSpecialsSection({ storeName, data }) {
  const rows = data?.data || [];
  const activeDate = data?.snapshot_date;
  const allDealers = (data?.all_dealers || [...new Set(rows.map(r => r.offer_dealer_name).filter(Boolean))]).sort();
  const models = [...new Set(rows.map(r => r.model).filter(Boolean))].sort();

  const colW = buildColWidths(allDealers.length || 1);
  const tableHeaderH = 28;
  const tableHeaderY = HEADER_H + 4;

  // Pre-compute row heights
  const rowHeights = models.map(model => {
    const maxH = Math.max(...allDealers.map(d => {
      const items = rows.filter(r => r.model === model && r.offer_dealer_name === d);
      return cellHeight(items);
    }), ROW_H);
    return maxH + CARD_GAP;
  });

  const totalH = tableHeaderY + tableHeaderH + rowHeights.reduce((a, b) => a + b, 0) + 16;

  let cursorY = tableHeaderY + tableHeaderH;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={totalH} style={{ background: '#fff' }}>
      <SvgHeader storeName={storeName} title="New Vehicle Specials" date={activeDate} />
      {/* Table header */}
      <rect x={MARGIN} y={tableHeaderY} width={W - MARGIN * 2} height={tableHeaderH} fill="#f9fafb" />
      <SvgText x={MARGIN + 8} y={tableHeaderY + tableHeaderH / 2} text="MODEL" fontSize={9} fontWeight="700" fill="#9ca3af" anchor="start" />
      {allDealers.map((d, i) => (
        <SvgText key={d} x={MARGIN + COL_LABEL_W + i * colW + colW / 2} y={tableHeaderY + tableHeaderH / 2} text={d.toUpperCase()} fontSize={9} fontWeight="700" fill="#374151" anchor="middle" maxWidth={colW - 6} />
      ))}
      <line x1={MARGIN} y1={tableHeaderY + tableHeaderH} x2={W - MARGIN} y2={tableHeaderY + tableHeaderH} stroke="#e5e7eb" strokeWidth="1" />

      {models.map((model, mi) => {
        const rowY = cursorY;
        const rowH = rowHeights[mi];
        cursorY += rowH;
        const bg = mi % 2 === 1 ? '#fafafa' : '#ffffff';
        const hasAny = allDealers.some(d => rows.some(r => r.model === model && r.offer_dealer_name === d));
        if (!hasAny) return null;

        return (
          <g key={model}>
            <rect x={MARGIN} y={rowY} width={W - MARGIN * 2} height={rowH} fill={bg} />
            <SvgText x={MARGIN + 8} y={rowY + 20} text={model} fontSize={11} fontWeight="700" fill="#111827" anchor="start" maxWidth={COL_LABEL_W - 12} />
            {allDealers.map((d, di) => {
              const items = rows.filter(r => r.model === model && r.offer_dealer_name === d);
              const cellX = MARGIN + COL_LABEL_W + di * colW;
              let cardY = rowY + CARD_GAP;
              return (
                <g key={d}>
                  {items.map((s, si) => {
                    const cardY2 = cardY;
                    cardY += cardHeight(s) + CARD_GAP;
                    return <SvgSpecialCard key={si} x={cellX + 3} y={cardY2} w={colW - 6} s={s} />;
                  })}
                  {items.length === 0 && (
                    <SvgText x={cellX + colW / 2} y={rowY + rowH / 2} text="—" fontSize={10} fill="#d1d5db" anchor="middle" />
                  )}
                </g>
              );
            })}
            <line x1={MARGIN} y1={rowY + rowH} x2={W - MARGIN} y2={rowY + rowH} stroke="#f3f4f6" strokeWidth="1" />
          </g>
        );
      })}
    </svg>
  );
}

// ─── 4. New Vehicle Specials — Visual (images) ───────────────────────────────

const VIS_IMG_H = 120;
const VIS_ROW_PAD = 8;

/** Accepts imageDataMap: { [image_url]: base64DataUrl } — pre-fetched by caller */
export function NewSpecialsVisualSection({ storeName, data, imageDataMap = {} }) {
  const rows = data?.data || [];
  const activeDate = data?.snapshot_date;
  const allDealers = (data?.all_dealers || [...new Set(rows.map(r => r.offer_dealer_name).filter(Boolean))]).sort();
  const models = [...new Set(rows.map(r => r.model).filter(Boolean))].sort();
  const imageRows = rows.filter(r => r.image_url);
  const colW = buildColWidths(allDealers.length || 1);
  const tableHeaderH = 28;
  const tableHeaderY = HEADER_H + 4;

  const rowHeights = models.map(model => {
    const maxImgs = Math.max(...allDealers.map(d =>
      imageRows.filter(r => r.model === model && r.offer_dealer_name === d).length
    ), 0);
    if (maxImgs === 0) return 0;
    return maxImgs * (VIS_IMG_H + VIS_ROW_PAD) + VIS_ROW_PAD * 2;
  });

  const totalH = tableHeaderY + tableHeaderH + rowHeights.reduce((a, b) => a + b, 0) + 16;
  let cursorY = tableHeaderY + tableHeaderH;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={totalH} style={{ background: '#fff' }}>
      <SvgHeader storeName={storeName} title="New Vehicle Specials — Visual" date={activeDate} />
      <rect x={MARGIN} y={tableHeaderY} width={W - MARGIN * 2} height={tableHeaderH} fill="#f9fafb" />
      <SvgText x={MARGIN + 8} y={tableHeaderY + tableHeaderH / 2} text="MODEL" fontSize={9} fontWeight="700" fill="#9ca3af" anchor="start" />
      {allDealers.map((d, i) => (
        <SvgText key={d} x={MARGIN + COL_LABEL_W + i * colW + colW / 2} y={tableHeaderY + tableHeaderH / 2} text={d.toUpperCase()} fontSize={9} fontWeight="700" fill="#374151" anchor="middle" maxWidth={colW - 6} />
      ))}
      <line x1={MARGIN} y1={tableHeaderY + tableHeaderH} x2={W - MARGIN} y2={tableHeaderY + tableHeaderH} stroke="#e5e7eb" strokeWidth="1" />

      {models.map((model, mi) => {
        const rowH = rowHeights[mi];
        const rowY = cursorY;
        cursorY += rowH;
        if (rowH === 0) return null;
        const bg = mi % 2 === 1 ? '#fafafa' : '#ffffff';
        return (
          <g key={model}>
            <rect x={MARGIN} y={rowY} width={W - MARGIN * 2} height={rowH} fill={bg} />
            <SvgText x={MARGIN + 8} y={rowY + 20} text={model} fontSize={11} fontWeight="700" fill="#111827" anchor="start" maxWidth={COL_LABEL_W - 12} />
            {allDealers.map((d, di) => {
              const cellX = MARGIN + COL_LABEL_W + di * colW;
              const items = imageRows.filter(r => r.model === model && r.offer_dealer_name === d);
              return (
                <g key={d}>
                  {items.map((s, si) => {
                    const imgY = rowY + VIS_ROW_PAD + si * (VIS_IMG_H + VIS_ROW_PAD);
                    const src = imageDataMap[s.image_url] || null;
                    return (
                      <g key={si}>
                        <rect x={cellX + 3} y={imgY} width={colW - 6} height={VIS_IMG_H} rx={4} fill="#f3f4f6" />
                        {src && (
                          <image
                            href={src}
                            x={cellX + 3}
                            y={imgY}
                            width={colW - 6}
                            height={VIS_IMG_H}
                            preserveAspectRatio="xMidYMid meet"
                            clipPathUnits="userSpaceOnUse"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <line x1={MARGIN} y1={rowY + rowH} x2={W - MARGIN} y2={rowY + rowH} stroke="#f3f4f6" strokeWidth="1" />
          </g>
        );
      })}
    </svg>
  );
}

// ─── 5. Service Specials ─────────────────────────────────────────────────────

const SVC_TITLE_H = 15;
const SVC_PRICE_H = 18;
const SVC_DETAIL_H = 13;
const SVC_CARD_PAD = 5;

function svcCardHeight(s) {
  let h = SVC_CARD_PAD;
  if (s.offer_title) h += SVC_TITLE_H;
  if (s.price) h += SVC_PRICE_H;
  if (s.offer_details) h += SVC_DETAIL_H * 2; // allow 2 lines
  h += SVC_CARD_PAD;
  return Math.max(h, 32);
}

function svcCellHeight(items) {
  if (!items.length) return ROW_H;
  return items.reduce((acc, s) => acc + svcCardHeight(s) + CARD_GAP, CARD_GAP);
}

function SvgServiceCard({ x, y, w, s }) {
  const h = svcCardHeight(s);
  let cursor = y + SVC_CARD_PAD;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} fill="#ffffff" stroke="#e5e7eb" strokeWidth="0.8" />
      {s.offer_title && (
        <>
          <SvgText x={x + SVC_CARD_PAD} y={cursor + SVC_TITLE_H / 2} text={s.offer_title} fontSize={9} fontWeight="700" fill="#2563eb" anchor="start" maxWidth={w - SVC_CARD_PAD * 2} />
          {(() => { cursor += SVC_TITLE_H; return null; })()}
        </>
      )}
      {s.price && (
        <>
          <SvgText x={x + SVC_CARD_PAD} y={cursor + SVC_PRICE_H / 2} text={s.price} fontSize={12} fontWeight="800" fill="#111111" anchor="start" maxWidth={w - SVC_CARD_PAD * 2} />
          {(() => { cursor += SVC_PRICE_H; return null; })()}
        </>
      )}
      {s.offer_details && (
        <SvgText x={x + SVC_CARD_PAD} y={cursor + SVC_DETAIL_H / 2} text={s.offer_details} fontSize={8} fill="#6b7280" anchor="start" maxWidth={w - SVC_CARD_PAD * 2} />
      )}
    </g>
  );
}

export function ServiceSpecialsSection({ storeName, data }) {
  const rows = data?.data || [];
  const activeDate = data?.snapshot_date;
  const allDealers = (data?.all_dealers || [...new Set(rows.map(r => r.offer_dealer_name).filter(Boolean))]).sort();
  const categories = [...new Set(rows.map(r => r.service_type).filter(Boolean))].sort();
  const colW = buildColWidths(allDealers.length || 1);
  const tableHeaderH = 28;
  const tableHeaderY = HEADER_H + 4;

  const rowHeights = categories.map(cat => {
    const maxH = Math.max(...allDealers.map(d => {
      const items = rows.filter(r => r.service_type === cat && r.offer_dealer_name === d);
      return svcCellHeight(items);
    }), ROW_H);
    return maxH + CARD_GAP;
  });

  const totalH = tableHeaderY + tableHeaderH + rowHeights.reduce((a, b) => a + b, 0) + 16;
  let cursorY = tableHeaderY + tableHeaderH;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={totalH} style={{ background: '#fff' }}>
      <SvgHeader storeName={storeName} title="Service Specials" date={activeDate} />
      <rect x={MARGIN} y={tableHeaderY} width={W - MARGIN * 2} height={tableHeaderH} fill="#f9fafb" />
      <SvgText x={MARGIN + 8} y={tableHeaderY + tableHeaderH / 2} text="CATEGORY" fontSize={9} fontWeight="700" fill="#9ca3af" anchor="start" />
      {allDealers.map((d, i) => (
        <SvgText key={d} x={MARGIN + COL_LABEL_W + i * colW + colW / 2} y={tableHeaderY + tableHeaderH / 2} text={d.toUpperCase()} fontSize={9} fontWeight="700" fill="#374151" anchor="middle" maxWidth={colW - 6} />
      ))}
      <line x1={MARGIN} y1={tableHeaderY + tableHeaderH} x2={W - MARGIN} y2={tableHeaderY + tableHeaderH} stroke="#e5e7eb" strokeWidth="1" />

      {categories.map((cat, ci) => {
        const rowH = rowHeights[ci];
        const rowY = cursorY;
        cursorY += rowH;
        const bg = ci % 2 === 1 ? '#fafafa' : '#ffffff';
        const hasAny = allDealers.some(d => rows.some(r => r.service_type === cat && r.offer_dealer_name === d));
        if (!hasAny) return null;

        return (
          <g key={cat}>
            <rect x={MARGIN} y={rowY} width={W - MARGIN * 2} height={rowH} fill={bg} />
            <SvgText x={MARGIN + 8} y={rowY + 20} text={cat} fontSize={11} fontWeight="700" fill="#111827" anchor="start" maxWidth={COL_LABEL_W - 12} />
            {allDealers.map((d, di) => {
              const items = rows.filter(r => r.service_type === cat && r.offer_dealer_name === d);
              const cellX = MARGIN + COL_LABEL_W + di * colW;
              let cardY = rowY + CARD_GAP;
              return (
                <g key={d}>
                  {items.map((s, si) => {
                    const cardY2 = cardY;
                    cardY += svcCardHeight(s) + CARD_GAP;
                    return <SvgServiceCard key={si} x={cellX + 3} y={cardY2} w={colW - 6} s={s} />;
                  })}
                  {items.length === 0 && (
                    <SvgText x={cellX + colW / 2} y={rowY + rowH / 2} text="—" fontSize={10} fill="#d1d5db" anchor="middle" />
                  )}
                </g>
              );
            })}
            <line x1={MARGIN} y1={rowY + rowH} x2={W - MARGIN} y2={rowY + rowH} stroke="#f3f4f6" strokeWidth="1" />
          </g>
        );
      })}
    </svg>
  );
}