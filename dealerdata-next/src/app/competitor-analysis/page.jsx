'use client';

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ModelInventoryView from '@/components/competitive/ModelInventoryView';
import SoldVehiclesView from '@/components/competitive/SoldVehiclesView';
import NewVehicleSpecialsView from '@/components/competitive/NewVehicleSpecialsView';
import ServiceSpecialsView from '@/components/competitive/ServiceSpecialsView';
import { useDealer } from '@/lib/DealerContext';
import { findMatchingStore } from '@/lib/storeMatching';

const VIEWS = [
  { key: 'inventory', label: 'Inventory & Pricing', desc: 'Units in stock and price ranges per model across all competitors' },
  { key: 'sold', label: 'Sold Vehicles', desc: 'Vehicles sold (removed from website) vs. the prior day snapshot across all competitors' },
  { key: 'new_specials', label: 'New Vehicle Specials', desc: 'Current financing and lease specials on new vehicles' },
];

function CompetitorAnalysisContent() {
  const dealer = useDealer();
  const { selectedType, activeStores, stores, groups, select, selectedId } = dealer || {};
  const isGroup = selectedType === 'group';
  const searchParams = useSearchParams();

  // Normalize raw views
  const rawView = searchParams.get('view') || 'inventory';
  const activeView = rawView === 'pricing'
    ? 'inventory'
    : rawView === 'specials'
      ? 'new_specials'
      : rawView === 'service_specials'
        ? 'inventory'
        : rawView;

  const storeQuery = searchParams.get('store') ||
    searchParams.get('store_id') ||
    searchParams.get('store_name') ||
    searchParams.get('dealer') ||
    searchParams.get('dealer_id');

  // Match store across all stores or current activeStores
  const storeFromUrl = useMemo(() => {
    if (!storeQuery) return null;
    return findMatchingStore(stores, storeQuery) || findMatchingStore(activeStores, storeQuery);
  }, [storeQuery, stores, activeStores]);

  // Synchronize global dealer selection and local dropdown state if store comes from URL
  useEffect(() => {
    if (!storeFromUrl || !select) return;

    if (storeFromUrl.group_id && groups && groups.some(g => g.id === storeFromUrl.group_id)) {
      if (selectedId !== storeFromUrl.group_id) {
        select('group', storeFromUrl.group_id);
      }
    } else {
      if (selectedId !== storeFromUrl.id) {
        select('store', storeFromUrl.id);
      }
    }
    setSelectedStoreName(storeFromUrl.name);
  }, [storeFromUrl, groups, selectedId, select]);

  const defaultStore = storeFromUrl || activeStores?.[0] || null;
  const [selectedStoreName, setSelectedStoreName] = useState(defaultStore?.name || null);

  // Sync dropdown when storeFromUrl changes or when activeStores load
  useEffect(() => {
    if (storeFromUrl?.name) {
      setSelectedStoreName(storeFromUrl.name);
    } else if (activeStores && activeStores.length > 0) {
      if (!activeStores.some(s => s.name === selectedStoreName)) {
        setSelectedStoreName(activeStores[0].name);
      }
    }
  }, [storeFromUrl?.name, activeStores]);

  const current = VIEWS.find(v => v.key === activeView) || VIEWS[0];
  const selectedStore = (activeStores && activeStores.find(s => s.name === selectedStoreName)) ||
    storeFromUrl ||
    activeStores?.[0];

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

        {activeStores && activeStores.length > 0 && (
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
        {activeView === 'sold' && <SoldVehiclesView store={selectedStore} />}
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
