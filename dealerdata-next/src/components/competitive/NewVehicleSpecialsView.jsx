import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import SnapshotDatePicker from './SnapshotDatePicker';

const BADGE_STYLES = {
  lease: 'bg-violet-100 text-violet-700',
  apr: 'bg-blue-100 text-blue-700',
  finance: 'bg-blue-100 text-blue-700',
  purchase: 'bg-emerald-100 text-emerald-700',
  discount: 'bg-emerald-100 text-emerald-800 border border-emerald-300/60',
  cash: 'bg-emerald-100 text-emerald-800 border border-emerald-300/60',
  savings: 'bg-emerald-100 text-emerald-800 border border-emerald-300/60',
  rebate: 'bg-emerald-100 text-emerald-800 border border-emerald-300/60',
  'cash back': 'bg-emerald-100 text-emerald-800 border border-emerald-300/60',
  reward: 'bg-amber-100 text-amber-800 border border-amber-300/60',
  visual: 'bg-amber-100 text-amber-800 border border-amber-200',
  'visual flyer': 'bg-amber-100 text-amber-800 border border-amber-200',
  default: 'bg-gray-100 text-gray-600',
};

function getBadgeStyle(offerType) {
  const t = (offerType || '').toLowerCase();
  for (const key of Object.keys(BADGE_STYLES)) {
    if (t.includes(key)) return BADGE_STYLES[key];
  }
  return BADGE_STYLES.default;
}

function DollarAmount({ value }) {
  if (!value) return value;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d+)(.*)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return (
      <>
        <sup className="text-xs font-bold text-gray-700 -top-1">$</sup>
        {num.toLocaleString()}
        {match[2]}
      </>
    );
  }
  return trimmed;
}

function extractDiscountInfo(s) {
  if (!s) return null;
  const od = s.offer_details ? String(s.offer_details).trim() : '';
  const fullText = `${od} ${s.title || ''} ${s.disclaimer || ''} ${s.raw_text || ''}`.trim();

  // 1. Look for explicit dollar discounts: "$3,500 off", "save $3,500", "$3,500 total savings", "$4,000 cash back", "$1,000 gas card", etc.
  const regexPatterns = [
    /(?:save|saving|savings|discount|off|cash back|bonus cash|rebate|customer cash)\s*(?:up to\s*)?[:\$]?\s*\$?([0-9]{1,2},[0-9]{3}|[0-9]{3,5})/i,
    /\$([0-9]{1,2},[0-9]{3}|[0-9]{3,5})\s*(?:off|savings|discount|cash back|bonus cash|rebate|total savings|gas card)/i,
    /(?:save|discount|off|cash back|rebate)\s*(?:up to\s*)?([0-9]{1,2},[0-9]{3}|[0-9]{3,5})/i,
    /\$([0-9]{1,2},[0-9]{3}|[0-9]{3,5})/
  ];

  for (const regex of regexPatterns) {
    const m = fullText.match(regex);
    if (m && m[1]) {
      const num = parseInt(m[1].replace(/,/g, ''), 10);
      if (num >= 300 && num <= 25000) {
        let tag = 'OFF';
        if (/cash back|bonus cash/i.test(fullText)) tag = 'CASH BACK';
        else if (/gas card/i.test(fullText)) tag = 'GAS CARD';
        else if (/total savings|savings/i.test(fullText)) tag = 'SAVINGS';
        return {
          amount: num,
          tag,
          display: `$${num.toLocaleString()}`
        };
      }
    }
  }

  // 2. Check if offer_details has a percentage off (e.g. "10% OFF") or explicit string
  if (od && !od.toLowerCase().includes('modal') && !od.toLowerCase().includes('details')) {
    if (od.includes('%')) {
      return {
        amount: null,
        tag: 'OFF',
        display: od.toUpperCase().includes('OFF') ? od : `${od} OFF`
      };
    }
    const cleanNum = Number(od.replace(/[^0-9]/g, ''));
    if (!isNaN(cleanNum) && cleanNum >= 100 && cleanNum <= 25000) {
      return {
        amount: cleanNum,
        tag: 'OFF',
        display: `$${cleanNum.toLocaleString()}`
      };
    }
    return {
      amount: null,
      tag: 'OFF',
      display: od
    };
  }

  return null;
}

function cleanSpecialModelAndTrim(r) {
  if (!r) return r;
  let make = r.make || '';
  let model = (r.model || '').trim();
  let trim = (r.trim || '').trim();
  const title = r.title || '';
  const fullText = `${title} ${model} ${trim}`;

  // 1. Strip promo / pricing noise from trim
  trim = trim
    .replace(/\s*(?:[.,;:]|\$|for\s+[\$0-9]|mo\s+for|months\s+valid|lease\s+for|\/mo|valid\s+through|valid\s+throug|open\s+details|details\s+and\s+disclaimers).*$/i, '')
    .trim();

  // 2. Strip promo / pricing noise from model
  model = model
    .replace(/\s*(?:[.,;:]|\$|for\s+[\$0-9]|mo\s+for|months\s+valid|lease\s+for|\/mo|valid\s+through|valid\s+throug|open\s+details|details\s+and\s+disclaimers).*$/i, '')
    .replace(/^202[3-7]\s+/i, '')
    .replace(new RegExp('^' + make + '\\s+', 'i'), '')
    .trim();

  // 3. Known compound model/trim fixes
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

  // 4. Ford canonical model extraction if fullText contains it
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
    } else if (/^f-?250/i.test(model)) {
      model = 'F-250 Super Duty';
    } else if (/^f-?350/i.test(model)) {
      model = 'F-350 Super Duty';
    } else if (/^f-?450/i.test(model)) {
      model = 'F-450 Super Duty';
    } else if (/^maverick/i.test(model)) {
      model = 'Maverick';
    } else if (/^ranger/i.test(model)) {
      model = 'Ranger';
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
    }
  } else if (make.toLowerCase() === 'kia') {
    if (/niro\s*ev/i.test(model) || /niro\s*ev/i.test(fullText)) {
      model = 'Niro EV';
      if (/wave/i.test(fullText)) trim = 'Wave';
      else if (/wind/i.test(fullText)) trim = 'Wind';
    } else if (/^niro/i.test(model) || /\bniro\b/i.test(fullText)) {
      model = 'Niro';
      if (/ev/i.test(fullText)) model = 'Niro EV';
    } else if (/ev6/i.test(model) || /ev6/i.test(fullText)) {
      model = 'EV6';
      if (/gt-line/i.test(fullText)) trim = 'GT-Line';
      else if (/wind/i.test(fullText)) trim = 'Wind';
      else if (/light/i.test(fullText)) trim = 'Light';
    } else if (/ev9/i.test(model) || /ev9/i.test(fullText)) {
      model = 'EV9';
      if (/gt-line/i.test(fullText)) trim = 'GT-Line';
      else if (/land/i.test(fullText)) trim = 'Land';
      else if (/wind/i.test(fullText)) trim = 'Wind';
      else if (/light/i.test(fullText)) trim = 'Light';
    } else if (/ev3/i.test(model) || /ev3/i.test(fullText)) {
      model = 'EV3';
    } else if (/sportage/i.test(model) || /sportage/i.test(fullText)) {
      model = 'Sportage';
    } else if (/sorento/i.test(model) || /sorento/i.test(fullText)) {
      model = 'Sorento';
    } else if (/telluride/i.test(model) || /telluride/i.test(fullText)) {
      model = 'Telluride';
    } else if (/carnival/i.test(model) || /carnival/i.test(fullText)) {
      model = 'Carnival';
    } else if (/\bk4\b/i.test(model) || /\bk4\b/i.test(fullText)) {
      model = 'K4';
    } else if (/\bk5\b/i.test(model) || /\bk5\b/i.test(fullText)) {
      model = 'K5';
    } else if (/forte/i.test(model) || /forte/i.test(fullText)) {
      model = 'Forte';
    } else if (/soul/i.test(model) || /soul/i.test(fullText)) {
      model = 'Soul';
    }
  }

  let specialType = (r.special_type || r.offer_type || 'lease').toLowerCase();
  if (specialType === 'vehicle') {
    specialType = 'cash';
  }
  if (r.monthly_payment != null && r.monthly_payment > 0) {
    if (/\b(?:lease|leasing)\b/i.test(fullText) || !specialType) {
      specialType = 'lease';
    }
  } else if (r.apr != null && r.apr > 0) {
    specialType = 'apr';
  } else if (
    /\b(?:save|saving|savings|discount|off|cash back|bonus cash|rebate)\b/i.test(fullText) ||
    specialType === 'cash' ||
    specialType === 'discount'
  ) {
    specialType = 'discount';
  }

  return {
    ...r,
    model: model || r.model,
    trim: trim || null,
    special_type: specialType,
    offer_type: specialType,
  };
}

function OfferCard({ s }) {
  const [tooltip, setTooltip] = useState(false);
  const ref = useRef(null);
  const rawType = s.offer_type || s.special_type || '';
  const type = rawType.toLowerCase() === 'vehicle' ? 'cash' : rawType.toLowerCase();

  const isLease = type.includes('lease');
  const hasApr = (s.apr != null && s.apr >= 0) || type === 'apr';
  // Avoid treating legal APR repayment disclosure formulas (e.g. "$16.67 per $1,000" or "$15.15 per $1,000") as vehicle monthly payments
  const isBogusDisclosurePayment = s.monthly_payment != null && s.monthly_payment < 80 && hasApr;
  const hasMonthlyPayment = !isBogusDisclosurePayment && ((s.monthly_payment != null && s.monthly_payment > 0) || (isLease && s.monthly_payment != null));

  // Extract discount / savings info for cash and discount specials
  const discountInfo = useMemo(() => {
    if (hasMonthlyPayment || (hasApr && s.apr > 0)) return null;
    return extractDiscountInfo(s);
  }, [hasMonthlyPayment, hasApr, s]);

  // If card has type "vehicle" or "cash" with no actionable terms (no monthly payment, no APR, no discount, no price/details), hide it
  if ((rawType.toLowerCase() === 'vehicle' || type === 'cash') && !hasMonthlyPayment && !hasApr && !discountInfo && !s.offer_details && !s.selling_price && !s.down_payment && !s.term) {
    return null;
  }

  let badgeLabel = hasApr && !hasMonthlyPayment
    ? 'APR'
    : isLease && hasMonthlyPayment
    ? 'LEASE'
    : hasApr
    ? 'APR'
    : type === 'cash' || rawType.toLowerCase() === 'vehicle'
    ? 'CASH'
    : rawType.toUpperCase();
  let badgeStyle = getBadgeStyle(hasApr && !hasMonthlyPayment ? 'apr' : isLease && hasMonthlyPayment ? 'lease' : hasApr ? 'apr' : type === 'cash' || rawType.toLowerCase() === 'vehicle' ? 'cash' : rawType);

  if (discountInfo && !hasMonthlyPayment && !hasApr) {
    if (discountInfo.tag === 'CASH BACK') {
      badgeLabel = 'CASH BACK';
      badgeStyle = getBadgeStyle('cash back');
    } else if (discountInfo.tag === 'GAS CARD') {
      badgeLabel = 'REWARD';
      badgeStyle = getBadgeStyle('reward');
    } else {
      badgeLabel = 'DISCOUNT';
      badgeStyle = getBadgeStyle('discount');
    }
  }

  // Safety: never show "VEHICLE" as a badge label
  if (badgeLabel === 'VEHICLE') {
    badgeLabel = 'CASH';
    badgeStyle = getBadgeStyle('cash');
  }

  let cleanUrl = s.special_url;
  if (cleanUrl) {
    cleanUrl = cleanUrl
      .replace(/^https?:\/\/gardengrovehyundai\.com/i, 'https://www.gardengrovehyundai.com')
      .replace(/^https?:\/\/huntingtonbeachhyundai\.com/i, 'https://www.huntingtonbeachhyundai.com')
      .replace(/^https?:\/\/tuttleclickhyundai\.com/i, 'https://www.tuttleclickhyundai.com')
      .replace(/^https?:\/\/hyundaiofanaheim\.com/i, 'https://www.hyundaiofanaheim.com')
      .replace(/^https?:\/\/lagunaniguelhyundai\.com/i, 'https://www.lagunaniguelhyundai.com');
  }

  const CardWrapper = cleanUrl ? 'a' : 'div';
  const wrapperProps = cleanUrl
    ? {
        href: cleanUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {};

  const monthlyVal = s.monthly_payment ? Math.round(s.monthly_payment) : s.offer_details;
  const aprRate = s.apr != null ? s.apr : s.offer_details;

  return (
    <CardWrapper
      {...wrapperProps}
      ref={ref}
      className="block relative bg-white border border-gray-300 rounded-lg p-3 text-xs shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer no-underline text-inherit group"
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        {badgeLabel && (
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeStyle}`}>
            {badgeLabel}
          </span>
        )}
        {/* Preserved in DOM for data integrity, hidden visually per user requirement */}
        {s.trim && (
          <span className="hidden text-[10px] text-gray-500 font-medium truncate max-w-[110px]" title={s.trim}>
            {s.trim}
          </span>
        )}
      </div>

      {/* Preserved in DOM for data integrity, hidden visually per user requirement */}
      {s.title && (
        <p className="hidden text-xs font-semibold text-gray-900 leading-snug mb-1 line-clamp-2" title={s.title}>
          {s.title}
        </p>
      )}

      {hasMonthlyPayment && (
        <>
          {monthlyVal && (
            <p className="text-xl font-extrabold text-gray-900 leading-tight mt-1">
              <DollarAmount value={monthlyVal} />
            </p>
          )}
          {s.term && (
            <p className="text-sm font-semibold text-gray-500 mt-1">{s.term} months</p>
          )}
          {s.down_payment != null && (
            <p className="text-sm font-semibold text-gray-500">${Number(s.down_payment).toLocaleString()} down</p>
          )}
        </>
      )}

      {hasApr && !hasMonthlyPayment && (
        <>
          <div className="flex items-baseline gap-0.5 mt-1">
            {aprRate != null && aprRate !== '' && (
              <>
                <span className="text-xl font-extrabold text-gray-900 leading-tight">{aprRate}</span>
                <sup className="text-xs font-bold text-gray-700 -top-1">%</sup>
              </>
            )}
          </div>
          {s.term && (
            <p className="text-sm font-semibold text-gray-500 mt-1">{s.term} months</p>
          )}
          {s.down_payment != null && (
            <p className="text-sm font-semibold text-gray-500">${Number(s.down_payment).toLocaleString()} down</p>
          )}
        </>
      )}

      {!hasMonthlyPayment && !hasApr && (
        <>
          {discountInfo ? (
            <div className="mt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-gray-900 leading-tight">
                  <DollarAmount value={discountInfo.amount || discountInfo.display} />
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-300/80 px-1.5 py-0.5 rounded">
                  {discountInfo.tag}
                </span>
              </div>
              {s.term && <p className="text-sm font-semibold text-gray-500 mt-1">{s.term} months</p>}
              {s.down_payment != null && (
                <p className="text-sm font-semibold text-gray-500">${Number(s.down_payment).toLocaleString()} down</p>
              )}
            </div>
          ) : s.offer_details ? (
            <p className="text-xl font-extrabold text-gray-900 leading-tight mt-1">
              {String(s.offer_details).includes('%') ? (
                s.offer_details
              ) : Number(s.offer_details) > 0 ? (
                <DollarAmount value={s.offer_details} />
              ) : (
                s.offer_details
              )}
            </p>
          ) : (
            <p className="text-xs font-medium text-gray-600 mt-1 line-clamp-2" title={s.title}>
              {s.title || 'Special Offer'}
            </p>
          )}
          {s.term && !discountInfo && <p className="text-sm font-semibold text-gray-500 mt-1">{s.term} months</p>}
          {s.down_payment != null && !discountInfo && (
            <p className="text-sm font-semibold text-gray-500">${Number(s.down_payment).toLocaleString()} down</p>
          )}
        </>
      )}

      {tooltip && (s.disclaimer || s.title || s.offer_details || discountInfo) && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-slate-800 text-white text-xs rounded-xl shadow-xl p-3 leading-relaxed pointer-events-none space-y-1.5">
          {s.title && <p className="font-semibold text-slate-100">{s.title}</p>}
          <div className="flex items-center gap-2">
            {badgeLabel && <p className={`font-bold ${badgeStyle} px-2 py-0.5 rounded-full inline-block`}>{badgeLabel}</p>}
            {hasMonthlyPayment && monthlyVal && <span className="text-white font-bold"><DollarAmount value={monthlyVal} /></span>}
            {hasApr && !hasMonthlyPayment && aprRate && <span className="text-white font-bold">{aprRate}%</span>}
            {discountInfo && !hasMonthlyPayment && !hasApr && (
              <span className="text-emerald-300 font-bold">{discountInfo.display} {discountInfo.tag}</span>
            )}
          </div>
          {s.term && <p className="text-slate-300">{s.term} months</p>}
          {s.down_payment != null && <p className="text-slate-300">${Number(s.down_payment).toLocaleString()} down</p>}
          {s.disclaimer && (
            <p className="text-[10px] text-slate-400 border-t border-slate-700 pt-1 line-clamp-4">{s.disclaimer}</p>
          )}
        </div>
      )}
    </CardWrapper>
  );
}

export default function NewVehicleSpecialsView({ store }) {
  const storeId = store?.id || null;
  const storeName = store?.name || null;

  const { data: storeCompetitors, isFetched: competitorsFetched } = useQuery({
    queryKey: ['storeCompetitors', storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => base44.entities.StoreCompetitor.filter({ store_id: storeId }),
  });

  const canonicalNames = useMemo(() => {
    if (!storeName) return [];
    return [...new Set([storeName, ...(storeCompetitors || []).map(c => c.name)])];
  }, [storeName, storeCompetitors]);

  const competitorNames = useMemo(() => {
    if (!storeName) return [];
    const names = [storeName];
    (storeCompetitors || []).forEach(c => {
      names.push(c.name);
      if (c.alias_names) c.alias_names.split('|').forEach(a => { if (a.trim()) names.push(a.trim()); });
    });
    return [...new Set(names)];
  }, [storeName, storeCompetitors]);

  const [snapshotDate, setSnapshotDate] = useState(null);
  const [view, setView] = useState('pivot');
  const [makeFilter, setMakeFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [offerTypeFilter, setOfferTypeFilter] = useState('all');
  const [showYear, setShowYear] = useState(false);
  const [showTrim, setShowTrim] = useState(false);
  const [hoveredImage, setHoveredImage] = useState(null);
  const [activeModalImage, setActiveModalImage] = useState(null);

  const { data: result, isLoading } = useQuery({
    queryKey: ['competitorVehicleSpecials', storeId, competitorNames.join(','), snapshotDate],
    enabled: competitorNames.length > 0 && (!storeId || competitorsFetched),
    queryFn: () => base44.functions.invoke('supabaseCompetitorVehicleSpecials', {
      competitor_names: competitorNames,
      snapshot_date: snapshotDate,
      store_id: storeId,
    }).then(r => r.data),
  });

  const rawRows = result?.data || [];
  const rows = useMemo(() => {
    return rawRows
      .filter(r => {
        const m = (r.model || '').toLowerCase();
        if (m.includes('details and disclaimers') || m.includes('open details modal')) return false;
        const type = (r.special_type || r.offer_type || '').toLowerCase();
        // Hide card if it's an unclassified 'vehicle' card with no actionable terms
        if (type === 'vehicle' && !r.monthly_payment && r.apr == null && !r.offer_details && !r.selling_price) {
          return false;
        }
        return true;
      })
      .map(cleanSpecialModelAndTrim);
  }, [rawRows]);
  const availableDates = result?.available_dates || [];
  const activeDate = result?.snapshot_date;

  // Build alias→canonical map so aliased names resolve to canonical column
  const aliasToCanonical = useMemo(() => {
    const map = {};
    (storeCompetitors || []).forEach(c => {
      if (c.alias_names) c.alias_names.split('|').forEach(a => { if (a.trim()) map[a.trim()] = c.name; });
      if (c.competitor_key) map[c.competitor_key] = c.name;
    });
    return map;
  }, [storeCompetitors]);

  const makes = useMemo(() => [...new Set(rows.map(r => r.make).filter(Boolean))].sort(), [rows]);
  const models = useMemo(() => {
    const src = makeFilter === 'all' ? rows : rows.filter(r => r.make === makeFilter);
    return [...new Set(src.map(r => r.model).filter(Boolean))].sort();
  }, [rows, makeFilter]);
  const offerTypes = useMemo(() => {
    const raw = rows.map(r => r.offer_type).filter(Boolean);
    const cleaned = raw
      .map(t => (t.toLowerCase() === 'vehicle' ? 'cash' : t.toLowerCase()))
      .filter(t => t !== 'vehicle');
    return [...new Set(cleaned)].sort();
  }, [rows]);
  // Always use configured canonical names as columns
  const dealers = useMemo(() => canonicalNames, [canonicalNames]);

  const filtered = useMemo(() => rows.filter(r => {
    if (view === 'pivot' && r.is_pending_ai) return false;
    const rType = (r.offer_type || '').toLowerCase() === 'vehicle' ? 'cash' : (r.offer_type || '').toLowerCase();
    const fType = offerTypeFilter.toLowerCase();
    return (
      (makeFilter === 'all' || r.make === makeFilter) &&
      (modelFilter === 'all' || r.model === modelFilter) &&
      (offerTypeFilter === 'all' || rType === fType)
    );
  }), [rows, view, makeFilter, modelFilter, offerTypeFilter]);

  // Pivot rows: unique combos based on active toggles
  const pivotRows = useMemo(() => {
    const key = r => [
      showYear ? (r.year ?? '') : '',
      r.model ?? '',
      showTrim ? (r.trim ?? '') : '',
    ].join('||');

    const unique = [...new Set(filtered.map(key))];
    return unique
      .map(k => {
        const [year, model, trim] = k.split('||');
        return {
          year: showYear ? (year || null) : null,
          model: model || null,
          trim: showTrim ? (trim || null) : null,
        };
      })
      .sort((a, b) => {
        if (a.model === 'Special Offer') return 1;
        if (b.model === 'Special Offer') return -1;
        const yCmp = showYear ? (String(a.year || '')).localeCompare(String(b.year || '')) : 0;
        if (yCmp !== 0) return yCmp;
        const mCmp = (a.model || '').localeCompare(b.model || '');
        if (mCmp !== 0) return mCmp;
        return showTrim ? (a.trim || '').localeCompare(b.trim || '') : 0;
      });
  }, [filtered, showYear, showTrim]);

  if (!storeName) {
    return <div className="text-gray-400 text-sm py-10 text-center">Select a store to view vehicle specials.</div>;
  }

  if (isLoading) return <div className="text-gray-400 text-sm py-10 text-center">Loading...</div>;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No vehicle specials found for this dealer.</p>
        </div>
      </div>
    );
  }

  const yearColW = 60;
  const trimColW = 110;
  const modelColW = 150;
  const dealerColW = 240;
  const totalW = (showYear ? yearColW : 0) + modelColW + (showTrim ? trimColW : 0) + dealerColW * dealers.length;

  const yearLeft = 0;
  const modelLeft = showYear ? yearColW : 0;
  const trimLeft = (showYear ? yearColW : 0) + modelColW;

  // Shared pivot table body (used by both Pivot and Visual views)
  const renderPivotTable = (imageOnly) => (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-auto max-h-[calc(100vh-210px)] min-h-[450px]">
      <table style={{ tableLayout: 'fixed', width: `${totalW}px`, borderCollapse: 'separate', borderSpacing: 0 }}>
        <colgroup>
          {showYear && <col style={{ width: `${yearColW}px` }} />}
          <col style={{ width: `${modelColW}px` }} />
          {showTrim && <col style={{ width: `${trimColW}px` }} />}
          {dealers.map(d => <col key={d} style={{ width: `${dealerColW}px` }} />)}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {showYear && (
              <th
                style={{ position: 'sticky', top: 0, left: `${yearLeft}px`, zIndex: 30, width: `${yearColW}px` }}
                className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200"
              >
                Year
              </th>
            )}
            <th
              style={{
                position: 'sticky',
                top: 0,
                left: `${modelLeft}px`,
                zIndex: 30,
                width: `${modelColW}px`,
              }}
              className={`py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200 ${!showTrim ? 'border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]' : ''}`}
            >
              Model
            </th>
            {showTrim && (
              <th
                style={{
                  position: 'sticky',
                  top: 0,
                  left: `${trimLeft}px`,
                  zIndex: 30,
                  width: `${trimColW}px`,
                }}
                className="py-3 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
              >
                Trim
              </th>
            )}
            {dealers.map(d => (
              <th
                key={d}
                style={{ position: 'sticky', top: 0, zIndex: 20 }}
                className="py-3 px-4 text-left text-xs font-bold text-gray-800 bg-gray-50 border-b border-gray-200 leading-snug"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pivotRows.map((row, ri) => {
            const matchFn = r =>
              (row.model == null ? !r.model : r.model === row.model) &&
              (!showYear || (row.year == null ? !r.year : String(r.year) === String(row.year))) &&
              (!showTrim || (row.trim == null ? !r.trim : r.trim === row.trim));

            const hasData = dealers.some(d =>
              filtered.some(r => {
                const resolvedName = aliasToCanonical[r.offer_dealer_name] ?? r.offer_dealer_name;
                return resolvedName === d && matchFn(r) && (!imageOnly || r.image_url);
              })
            );
            if (!hasData) return null;

            const rowBg = ri % 2 === 1 ? 'bg-slate-50' : 'bg-white';

            return (
              <tr key={ri} className={`align-top border-b border-gray-100 ${rowBg}`}>
                {showYear && (
                  <td
                    style={{ position: 'sticky', left: `${yearLeft}px`, zIndex: 10 }}
                    className={`py-4 px-3 align-top text-xs text-gray-500 font-medium ${rowBg} border-b border-gray-100`}
                  >
                    {row.year ?? '—'}
                  </td>
                )}
                <td
                  style={{ position: 'sticky', left: `${modelLeft}px`, zIndex: 10 }}
                  className={`py-4 px-4 align-top ${rowBg} border-b border-gray-100 ${!showTrim ? 'border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]' : ''}`}
                >
                  <span className={`text-sm font-bold ${!row.model ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                    {row.model || 'Other'}
                  </span>
                </td>
                {showTrim && (
                  <td
                    style={{ position: 'sticky', left: `${trimLeft}px`, zIndex: 10 }}
                    className={`py-4 px-3 align-top text-xs text-gray-500 italic ${rowBg} border-b border-gray-100 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]`}
                  >
                    {row.trim ?? '—'}
                  </td>
                )}
                {dealers.map(d => {
                  const items = filtered.filter(r => {
                    const resolvedName = aliasToCanonical[r.offer_dealer_name] ?? r.offer_dealer_name;
                    return resolvedName === d && matchFn(r) && (!imageOnly || r.image_url);
                  });
                  return (
                    <td key={d} className="py-3 px-3 align-top border-b border-gray-100">
                      {items.length === 0 ? (
                        <span className="text-gray-200 text-xs">—</span>
                      ) : imageOnly ? (
                        <div className="space-y-2">
                          {items.map((s, i) => (
                            <div
                              key={i}
                              className="relative bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                              onClick={() => setActiveModalImage(s.image_url)}
                              title={s.title || 'Click to zoom image'}
                            >
                              <div className="relative rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                                <img
                                  src={s.image_url}
                                  alt={s.title || ''}
                                  className="w-full max-h-40 object-contain transition-transform group-hover:scale-105"
                                  style={{ display: 'block' }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-black/80 text-white px-2 py-0.5 rounded-full font-semibold shadow">
                                    Click to Zoom 🔍
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((s, i) => <OfferCard key={i} s={s} />)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {activeDate && (
        <p className="px-5 py-2 text-xs text-gray-400">
          Snapshot: {format(new Date(activeDate + 'T12:00:00'), 'MMMM d, yyyy')}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4 relative">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <SnapshotDatePicker dates={availableDates} selected={snapshotDate} onChange={setSnapshotDate} />

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setView('pivot')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${view === 'pivot' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Pivot</button>
          <button onClick={() => setView('visual')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${view === 'visual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Visuals</button>
        </div>

        {makes.length > 1 && (
          <select value={makeFilter} onChange={e => { setMakeFilter(e.target.value); setModelFilter('all'); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
            <option value="all">All Makes</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
          <option value="all">All Models</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {offerTypes.length > 0 && (
          <select value={offerTypeFilter} onChange={e => setOfferTypeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
            <option value="all">All Offer Types</option>
            {offerTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        )}

        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showYear} onChange={e => setShowYear(e.target.checked)} className="rounded" />
          By Year
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showTrim} onChange={e => setShowTrim(e.target.checked)} className="rounded" />
          By Trim
        </label>
      </div>

      {view === 'pivot' && renderPivotTable(false)}
      {view === 'visual' && renderPivotTable(true)}

      {/* Interactive Lightbox Modal */}
      {activeModalImage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 p-4 cursor-pointer backdrop-blur-sm"
          onClick={() => setActiveModalImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl p-3 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModalImage(null)}
              className="absolute -top-3 -right-3 bg-gray-900 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg hover:bg-black transition-colors"
            >
              ✕
            </button>
            <img
              src={activeModalImage}
              alt=""
              className="max-w-full max-h-[82vh] rounded-lg object-contain shadow-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}