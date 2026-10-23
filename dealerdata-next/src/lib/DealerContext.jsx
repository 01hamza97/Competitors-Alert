'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { normalizeDealerId } from '@/lib/useSupabaseData';

const DealerContext = createContext(null);

export function DealerProvider({ children }) {
  const [selectedId, setSelectedId] = useState('');
  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('selectedDealerId') || '';
      const savedType = localStorage.getItem('selectedDealerType') || '';
      if (savedId) setSelectedId(savedId);
      if (savedType) setSelectedType(savedType);
    }
  }, []);

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['dealerGroups'],
    queryFn: () => base44.entities.DealerGroup.list('name', 200),
  });

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => base44.entities.Store.list('name', 200),
  });

  const isDealerLoading = groupsLoading || storesLoading;

  // Auto-select first option if nothing is selected and data loads
  useEffect(() => {
    if (!selectedId && (groups.length > 0 || stores.length > 0)) {
      if (groups.length > 0) {
        setSelectedId(groups[0].id);
        setSelectedType('group');
      } else if (stores.length > 0) {
        setSelectedId(stores[0].id);
        setSelectedType('store');
      }
    }
  }, [groups, stores, selectedId]);

  const select = (type, id) => {
    setSelectedType(type);
    setSelectedId(id);
    localStorage.setItem('selectedDealerId', id);
    localStorage.setItem('selectedDealerType', type);
  };

  const selectedGroup = selectedType === 'group' ? groups.find(g => g.id === selectedId) : null;
  const selectedStore = selectedType === 'store' ? stores.find(s => s.id === selectedId) : null;

  // All stores for the current selection
  const activeStores = selectedType === 'group'
    ? stores.filter(s => s.group_id === selectedId)
    : selectedStore ? [selectedStore] : [];

  // Dealership keys to filter data by — normalized to match Supabase dealer_id format
  const activeDealershipKeys = activeStores.map(s => normalizeDealerId(s.dealership_key)).filter(Boolean);

  const selectedLabel = selectedGroup?.name || selectedStore?.name || '';

  return (
    <DealerContext.Provider value={{
      groups,
      stores,
      selectedId,
      selectedType,
      selectedGroup,
      selectedStore,
      activeStores,
      activeDealershipKeys,
      selectedLabel,
      select,
      isDealerLoading,
    }}>
      {children}
    </DealerContext.Provider>
  );
}

export function useDealer() {
  return useContext(DealerContext);
}