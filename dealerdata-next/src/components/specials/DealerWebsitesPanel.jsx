import React from 'react';
import { ExternalLink, Home, Star, Lightbulb } from 'lucide-react';

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function freshStatus(snapshotDate, today) {
  if (!snapshotDate) return { dot: 'bg-red-500', label: 'Not updated' };
  if (snapshotDate === today) return { dot: 'bg-green-500', label: 'Updated today' };
  const days = daysBetween(snapshotDate);
  if (days == null) return { dot: 'bg-red-500', label: 'Not updated' };
  if (days >= 1 && days <= 7) return { dot: 'bg-yellow-500', label: `${days}d ago` };
  return { dot: 'bg-red-500', label: 'Not updated' };
}

function PillLink({ href, icon: Icon, label }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold text-gray-600 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 border border-gray-200 transition-colors whitespace-nowrap">
      <Icon size={10} /> {label} <ExternalLink size={9} />
    </a>
  );
}

function DealerRow({ name, status, homepage, specials_url, isActive, onClick, isClient }) {
  return (
    <div onClick={onClick}
      className={`group rounded-lg border p-3 cursor-pointer transition-colors ${isActive ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.dot}`} />
        <span className={`text-sm font-bold flex-1 truncate ${isActive ? 'text-blue-900' : 'text-gray-800'}`}>{name}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 ml-[18px]">
        <PillLink href={homepage} icon={Home} label="Homepage" />
        <PillLink href={specials_url} icon={Star} label="Specials" />
      </div>
      <p className="text-[10px] text-gray-400 mt-1 ml-[18px]">{status.label}{isClient ? ' · client' : ''}</p>
    </div>
  );
}

// Sticky left column: client store + competitors + tips.
export default function DealerWebsitesPanel({ store, competitors, selectedDealer, onSelectDealer, freshness, today, viewMode }) {
  const storeStatus = freshStatus(freshness[store?.label]?.snapshot_date, today);
  return (
    <div className="space-y-3">
      {/* Client store */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Client Store</p>
        <DealerRow
          name={store?.label}
          status={storeStatus}
          homepage={store?.homepage}
          specials_url={store?.specials_url}
          isActive={selectedDealer === store?.label}
          onClick={() => onSelectDealer(store?.label)}
          isClient
        />
      </div>

      {/* Competitors */}
      {competitors.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Competitors</p>
          <div className="space-y-1.5">
            {competitors.map(c => {
              const st = freshStatus(freshness[c.label]?.snapshot_date, today);
              return (
                <DealerRow
                  key={c.label}
                  name={c.label}
                  status={st}
                  homepage={c.homepage}
                  specials_url={c.specials_url}
                  isActive={selectedDealer === c.label}
                  onClick={() => onSelectDealer(c.label)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Lightbulb size={14} className="text-blue-600" />
          <h3 className="text-xs font-bold text-blue-900">Tips for Today</h3>
        </div>
        <p className="text-[11px] text-blue-800 leading-relaxed">
          {viewMode === 'ai' ? (
            <>Review each AI-scraped row — fix mistakes inline, then <strong>Approve</strong> or <strong>Reject</strong>. Approved rows publish instantly. Use <strong>Approve All</strong> when everything looks clean.</>
          ) : (
            <>Check each dealer's homepage slider first, then the specials page. Look for <strong>lease payments</strong>, <strong>APR rates</strong>, and <strong>cash discounts</strong>. Skip banners without a specific price or rate.</>
          )}
        </p>
      </div>
    </div>
  );
}