'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ModelInventoryView from '@/components/competitive/ModelInventoryView';
import NewVehicleSpecialsView from '@/components/competitive/NewVehicleSpecialsView';
import ServiceSpecialsView from '@/components/competitive/ServiceSpecialsView';
import { useDealer } from '@/lib/DealerContext';

const VIEWS = [
  { key: 'inventory', label: 'Inventory & Pricing', desc: 'Units in stock and price ranges per model across all competitors' },
  { key: 'new_specials', label: 'New Vehicle Specials', desc: 'Current financing and lease specials on new vehicles' },
];

function CompetitorAnalysisContent() {
  const dealer = useDealer();
  const { selectedType, activeStores } = dealer || {};
  const isGroup = selectedType === 'group';
  const searchParams = useSearchParams();
  const rawView = searchParams.get('view') || 'inventory';
  const activeView = rawView === 'service_specials' ? 'inventory' : rawView;
  const defaultStore = activeStores?.[0] || null;
  const [selectedStoreName, setSelectedStoreName] = useState(defaultStore?.name || null);

  // Reset dropdown when global dealer selection changes
  const prevDefaultName = useRef(defaultStore?.name);
  if (prevDefaultName.current !== defaultStore?.name) {
    prevDefaultName.current = defaultStore?.name;
    setSelectedStoreName(defaultStore?.name || null);
  }
  const current = VIEWS.find(v => v.key === activeView) || VIEWS[0];
  const selectedStore = activeStores?.find(s => s.name === selectedStoreName) || activeStores?.[0];

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitive Analysis</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {current.label}
          </p>
        </div>

        {isGroup && activeStores && activeStores.length > 0 && (
          <select
            value={selectedStoreName || activeStores[0]?.name || ''}
            onChange={e => setSelectedStoreName(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {activeStores.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div>
        {activeView === 'inventory' && <ModelInventoryView store={selectedStore} />}
        {activeView === 'new_specials' && <NewVehicleSpecialsView store={selectedStore} />}
        {activeView === 'service_specials' && <ServiceSpecialsView store={selectedStore} />}
      </div>
    </div>
  );
}

export default function CompetitorAnalysisPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CompetitorAnalysisContent />
    </Suspense>
  );
}
