'use client';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import ScraperControlHub from '@/components/admin/ScraperControlHub';
import { RefreshCw, Mail, ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Zap } from 'lucide-react';
import TeamAndRbacSettings from '@/components/settings/TeamAndRbacSettings';
import EmailPreview from '@/components/admin/EmailPreview';
import SectionCard from '@/components/SectionCard';
import UnifiedStoreList from '@/components/admin/UnifiedStoreList';
import InternetLeadGroupings from '@/components/admin/InternetLeadGroupings';
import VehicleModelGroups from '@/components/admin/VehicleModelGroups';
import DealersJsonImport from '@/components/admin/DealersJsonImport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

function AdvancedMigrationTools() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8 border border-amber-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-3 bg-amber-50 hover:bg-amber-100 text-left transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-amber-500 shrink-0" /> : <ChevronRight size={14} className="text-amber-500 shrink-0" />}
        <span className="text-sm font-semibold text-amber-700">Advanced / Migration Tools</span>
        <span className="text-xs text-amber-500 ml-1">— Import dealers.json (one-time migration)</span>
      </button>
      {open && (
        <div className="p-5 bg-white">
          <DealersJsonImport />
        </div>
      )}
    </div>
  );
}

export default function AdminClients() {
  const [leadGroupsStoreId, setLeadGroupsStoreId] = useState('');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['dealerGroups'],
    queryFn: () => base44.entities.DealerGroup.list('name', 200),
  });

  const { data: stores = [], isLoading: loadingStores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => base44.entities.Store.list('name', 200),
  });

  const isLoading = loadingGroups || loadingStores;

  useEffect(() => {
    if (stores.length > 0 && !leadGroupsStoreId) {
      setLeadGroupsStoreId('__all__');
    }
  }, [stores, leadGroupsStoreId]);

  const selectedLeadGroupStore = leadGroupsStoreId === '__all__' ? null : stores.find(s => s.id === leadGroupsStoreId);

  // Admin-only check
  if (!isLoading && user && user.role !== 'admin') {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <SectionCard title="Access Denied">
          <p className="text-gray-400 text-sm">This page is only available to administrators.</p>
        </SectionCard>
      </div>
    );
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <RefreshCw className="animate-spin text-gray-400" size={24} />
    </div>
  );

  return (
    <div className="p-6 max-w-full mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin: Client Management</h1>
        <p className="text-gray-500 text-sm mt-0.5">Centralized user, group, and store management (admin only)</p>
      </div>

      <Tabs defaultValue="groups">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="groups">Groups & Stores</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="lead-groups">Lead Source Groups</TabsTrigger>
          <TabsTrigger value="vehicle-models">Vehicle Models</TabsTrigger>
          <TabsTrigger value="scraper" className="gap-1.5 text-amber-900 font-semibold bg-amber-50/50 data-[state=active]:bg-amber-100/80 data-[state=active]:text-amber-950">
            <Zap size={14} className="text-amber-500 fill-amber-500" /> Scraper Operations
          </TabsTrigger>
          <TabsTrigger value="email-preview" className="gap-1.5">
            <Mail size={14} /> Email Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scraper" className="mt-4">
          <ScraperControlHub />
        </TabsContent>

        <TabsContent value="groups" className="mt-4 space-y-5">
          <UnifiedStoreList groups={groups} stores={stores} />
          <AdvancedMigrationTools />
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-blue-900">Team & RBAC Centralized in Settings</p>
              <p className="text-xs text-blue-700">User management, custom RBAC roles, and notification subscriptions can also be managed under Dealership Settings.</p>
            </div>
            <Link
              href="/settings?tab=team"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm shrink-0 transition-colors"
            >
              Open in Settings <ExternalLink size={13} />
            </Link>
          </div>
          <TeamAndRbacSettings currentUser={user} />
        </TabsContent>

        <TabsContent value="lead-groups" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Store:</label>
              <Select value={leadGroupsStoreId} onValueChange={setLeadGroupsStoreId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a store…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-gray-500" />
                      All Stores
                    </div>
                  </SelectItem>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <Building2 size={13} className="text-gray-500" />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {leadGroupsStoreId === '__all__' ? (
              <InternetLeadGroupings allStores={stores} />
            ) : selectedLeadGroupStore ? (
              <InternetLeadGroupings store={selectedLeadGroupStore} />
            ) : (
              <p className="text-gray-400 text-sm">Select a store to manage lead source groups.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="vehicle-models" className="mt-4">
          <VehicleModelGroups />
        </TabsContent>

        <TabsContent value="email-preview" className="mt-4">
          <EmailPreview />
        </TabsContent>
      </Tabs>
    </div>
  );
}