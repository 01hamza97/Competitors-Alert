'use client';

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { normalizeDealerId } from '@/lib/useSupabaseData';
import { findMatchingStore } from '@/lib/storeMatching';
import { useAuth } from '@/lib/AuthContext';

const DealerContext = createContext(null);

export function DealerProvider({ children }) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const { data: rawGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['dealerGroups'],
    queryFn: () => base44.entities.DealerGroup.list('name', 200),
  });

  const { data: rawStores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => base44.entities.Store.list('name', 200),
  });

  // Filter stores according to user role and assigned store_ids / dealer_group_ids
  const stores = useMemo(() => {
    if (!user || user.role === 'admin') return rawStores;

    const userStoreIds = (user.store_ids || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const userGroupIds = (user.dealer_group_ids || '').split(',').map(g => g.trim().toLowerCase()).filter(Boolean);

    // If non-admin user has no stores or groups assigned, return empty list
    if (userStoreIds.length === 0 && userGroupIds.length === 0) return [];

    return rawStores.filter(store => {
      const candidates = [
        String(store.id).toLowerCase(),
        String(store.id).toLowerCase().replace(/^store_/, ''),
        `store_${String(store.id).toLowerCase().replace(/^store_/, '')}`,
        store.dealership_key ? String(store.dealership_key).toLowerCase() : null,
        store.scraper_store_id ? String(store.scraper_store_id).toLowerCase() : null,
      ].filter(Boolean);

      const hasStoreAccess = userStoreIds.some(id => candidates.includes(id));
      const hasGroupAccess = store.group_id && userGroupIds.some(id =>
        id === String(store.group_id).toLowerCase() || id === `grp_${String(store.group_id).toLowerCase()}`
      );

      return hasStoreAccess || hasGroupAccess;
    });
  }, [rawStores, user]);

  // Filter groups according to user role and whether group has user's permitted stores
  const groups = useMemo(() => {
    if (!user || user.role === 'admin') return rawGroups;

    const userGroupIds = (user.dealer_group_ids || '').split(',').map(g => g.trim().toLowerCase()).filter(Boolean);

    return rawGroups.filter(g => {
      const directGroupMatch = userGroupIds.some(id =>
        id === String(g.id).toLowerCase() || id === `grp_${String(g.id).toLowerCase()}`
      );
      // Group contains at least one store that the user is allowed to access
      const groupHasPermittedStore = stores.some(s => String(s.group_id) === String(g.id));
      return directGroupMatch || groupHasPermittedStore;
    });
  }, [rawGroups, stores, user]);

  const isDealerLoading = groupsLoading || storesLoading;

  // Validate and synchronize selection whenever stores, groups, or user permissions change
  useEffect(() => {
    if (isDealerLoading || (groups.length === 0 && stores.length === 0)) return;

    // Check URL parameters for permitted store selection
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlStore = urlParams.get('store') || urlParams.get('store_id') || urlParams.get('store_name') || urlParams.get('dealer') || urlParams.get('dealer_id');
        if (urlStore) {
          const matched = findMatchingStore(stores, urlStore);
          if (matched) {
            if (matched.group_id && groups.some(g => g.id === matched.group_id)) {
              setSelectedId(matched.group_id);
              setSelectedType('group');
              localStorage.setItem('selectedDealerId', matched.group_id);
              localStorage.setItem('selectedDealerType', 'group');
              return;
            } else {
              setSelectedId(matched.id);
              setSelectedType('store');
              localStorage.setItem('selectedDealerId', matched.id);
              localStorage.setItem('selectedDealerType', 'store');
              return;
            }
          }
        }
      } catch (e) {
        console.warn('[DealerContext] Error reading URL store param:', e);
      }
    }

    // Check if current selectedId is valid among permitted groups and stores
    const isCurrentSelectionValid =
      (selectedType === 'group' && groups.some(g => g.id === selectedId)) ||
      (selectedType === 'store' && stores.some(s => s.id === selectedId));

    if (!isCurrentSelectionValid) {
      // Check saved localStorage if valid for current user
      let restored = false;
      if (typeof window !== 'undefined') {
        const savedId = localStorage.getItem('selectedDealerId') || '';
        const savedType = localStorage.getItem('selectedDealerType') || '';
        if (
          (savedType === 'group' && groups.some(g => g.id === savedId)) ||
          (savedType === 'store' && stores.some(s => s.id === savedId))
        ) {
          setSelectedId(savedId);
          setSelectedType(savedType);
          restored = true;
        }
      }

      if (!restored) {
        // Fallback to first permitted store or group
        if (stores.length > 0) {
          setSelectedId(stores[0].id);
          setSelectedType('store');
          if (typeof window !== 'undefined') {
            localStorage.setItem('selectedDealerId', stores[0].id);
            localStorage.setItem('selectedDealerType', 'store');
          }
        } else if (groups.length > 0) {
          setSelectedId(groups[0].id);
          setSelectedType('group');
          if (typeof window !== 'undefined') {
            localStorage.setItem('selectedDealerId', groups[0].id);
            localStorage.setItem('selectedDealerType', 'group');
          }
        } else {
          setSelectedId('');
          setSelectedType('');
        }
      }
    }
  }, [groups, stores, selectedId, selectedType, isDealerLoading]);

  const select = (type, id) => {
    // Enforce permission: only allow selection if target is permitted for current user
    if (type === 'group' && !groups.some(g => g.id === id)) return;
    if (type === 'store' && !stores.some(s => s.id === id)) return;

    setSelectedType(type);
    setSelectedId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedDealerId', id);
      localStorage.setItem('selectedDealerType', type);
    }
  };

  const selectedGroup = selectedType === 'group' ? groups.find(g => g.id === selectedId) : null;
  const selectedStore = selectedType === 'store' ? stores.find(s => s.id === selectedId) : null;

  // All stores for the current selection — constrained to permitted stores
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
