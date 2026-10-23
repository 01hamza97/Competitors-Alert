'use client';

import { useState } from 'react';
import PerformanceControls from '@/components/dashboard/PerformanceControls';
import PerformanceKPIs from '@/components/dashboard/PerformanceKPIs';
import MTDTrendChart from '@/components/dashboard/MTDTrendChart';
import MTDBreakdown from '@/components/dashboard/MTDBreakdown';
import { useDealer } from '@/lib/DealerContext';

export default function DashboardPage() {
  const { selectedLabel, selectedType, activeStores } = useDealer();
  const isGroup = selectedType === 'group';

  const [period, setPeriod] = useState('yesterday');
  const [compare, setCompare] = useState(null);
  const [selectedDealership, setSelectedDealership] = useState(null);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        {selectedLabel && (
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            {selectedLabel}
          </p>
        )}
        <h1 className="text-2xl font-black text-gray-900">Lead Performance</h1>
      </div>

      {/* Global Controls */}
      <PerformanceControls
        period={period}
        onPeriodChange={setPeriod}
        compare={compare}
        onCompareChange={setCompare}
        dealership={selectedDealership}
        onDealershipChange={setSelectedDealership}
        stores={activeStores}
        isGroup={isGroup}
      />

      {/* Section 1: KPIs */}
      <PerformanceKPIs
        period={period}
        compare={compare}
        selectedDealership={selectedDealership}
      />

      <div className="border-t border-gray-100" />

      {/* Section 2: Trend Chart */}
      <MTDTrendChart
        period={period}
        compare={compare}
        selectedDealership={selectedDealership}
      />

      <div className="border-t border-gray-100" />

      {/* Section 3: Breakdown */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3">Lead Types</p>
        <MTDBreakdown comparison={compare} period={period} selectedDealership={selectedDealership} />
      </div>
    </div>
  );
}
