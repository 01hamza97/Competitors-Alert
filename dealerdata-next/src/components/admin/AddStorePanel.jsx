import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AddClientStoreForm from '@/components/wizard/AddClientStoreForm';
import AddCompetitorForm from '@/components/wizard/AddCompetitorForm';
import UnifiedStoreRow from '@/components/admin/UnifiedStoreRow';

// Top collapsible "Add New" panel with buttons + counts
export default function AddStorePanel({ stores, competitors, addGroupOpen, setAddGroupOpen, newGroupName, setNewGroupName, onAddGroup }) {
  const [open, setOpen] = useState(null); // 'store' | 'competitor' | null
  const [tick, setTick] = useState(0); // force re-mount of child forms after save to collapse

  // When the user finishes adding (clicks "Done"/"Add Another"), collapse.
  // We re-mount the form via `tick` so a fresh BLANK appears next time.
  const closeAndReset = () => { setOpen(null); setTick(t => t + 1); };

  const pillBtn = (active, children, rest) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-wrap">
        <button
          onClick={() => setAddGroupOpen(addGroupOpen ? null : true)}
          className={pillBtn(addGroupOpen === true)}
        >
          {addGroupOpen === true ? <ChevronDown size={14} /> : <Plus size={14} />} Add Dealer Group
        </button>
        <button
          onClick={() => setOpen(open === 'store' ? null : 'store')}
          className={pillBtn(open === 'store')}
        >
          {open === 'store' ? <ChevronDown size={14} /> : <Plus size={14} />} Add New Client Store
        </button>
        <button
          onClick={() => setOpen(open === 'competitor' ? null : 'competitor')}
          className={pillBtn(open === 'competitor')}
        >
          {open === 'competitor' ? <ChevronDown size={14} /> : <Plus size={14} />} Add Competitor
        </button>
        <div className="ml-auto text-sm text-gray-500">
          <strong className="text-gray-900">{stores.length}</strong> Client Stores <span className="text-gray-300 mx-1">|</span>
          <strong className="text-gray-900">{competitors.length}</strong> Competitors
        </div>
      </div>

      {addGroupOpen === true && (
        <div className="p-5 flex gap-2 items-center">
          <span className="text-sm font-semibold text-gray-700">New Group:</span>
          <Input placeholder="Group name *" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="text-sm h-8 w-56" />
          <Button size="sm" className="h-8" onClick={onAddGroup}>Create</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setAddGroupOpen(false)}>Cancel</Button>
        </div>
      )}

      {open && (
        <div className="p-5">
          {open === 'store' && (
            <AddClientStoreForm
              key={`store-${tick}`}
              onSwitchToCompetitor={() => { setOpen('competitor'); setTick(t => t + 1); }}
            />
          )}
          {open === 'competitor' && (
            <AddCompetitorForm key={`comp-${tick}`} stores={stores} />
          )}
        </div>
      )}
    </div>
  );
}