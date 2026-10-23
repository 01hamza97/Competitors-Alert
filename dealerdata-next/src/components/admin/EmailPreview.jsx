'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useDealer } from '@/lib/DealerContext';
import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { format, subDays } from 'date-fns';
import { getPeriodRange, getCompareRange } from '@/components/dashboard/PerformanceKPIs';
import { useLeadKpiSummary, useDealerRanking, useVendorSummary, useLeadTypeBreakdown } from '@/lib/useAggregatedData';
import { useActivityData, useAppointmentSnapshots } from '@/lib/useSupabaseData';

// Same grouping logic as VendorPerformance page
function buildGroupedRows(rawData, leadGroups) {
  if (!leadGroups || leadGroups.length === 0) {
    const map = {};
    rawData.forEach(r => {
      const src = r.lead_source || 'Unknown';
      if (!map[src]) map[src] = { source: src, goodLeads: 0, sold: 0 };
      map[src].goodLeads += r.total_leads;
      map[src].sold += r.total_sold;
    });
    return Object.values(map).map(row => ({
      ...row,
      soldPct: row.goodLeads > 0 ? Math.round((row.sold / row.goodLeads) * 100) : 0,
    }));
  }
  const sourceToGroup = {};
  const knownGroupNames = new Set(leadGroups.map(g => g.group_name));
  leadGroups.forEach(g => {
    const sources = g.raw_sources ? g.raw_sources.split('|').map(s => s.trim()).filter(Boolean) : [];
    sources.forEach(s => { sourceToGroup[s] = g.group_name; });
  });
  const map = {};
  rawData.forEach(r => {
    const src = r.lead_source || 'Unknown';
    const groupName = sourceToGroup[src] || (knownGroupNames.has(src) ? src : src);
    if (!map[groupName]) map[groupName] = { source: groupName, goodLeads: 0, sold: 0 };
    map[groupName].goodLeads += r.total_leads;
    map[groupName].sold += r.total_sold;
  });
  return Object.values(map).map(row => ({
    ...row,
    soldPct: row.goodLeads > 0 ? Math.round((row.sold / row.goodLeads) * 100) : 0,
  }));
}
import InternetPerformanceEmailGroup from '@/components/emails/InternetPerformanceEmailGroup';
import InternetPerformanceEmailStore from '@/components/emails/InternetPerformanceEmailStore';
import AppointmentsActivityEmailGroup from '@/components/emails/AppointmentsActivityEmailGroup';
import AppointmentsActivityEmailStore from '@/components/emails/AppointmentsActivityEmailStore';

export default function EmailPreview() {
  const { selectedLabel, selectedType, activeStores, activeDealershipKeys, selectedGroup, selectedId, stores: allStores } = useDealer();
  const isGroup = selectedType === 'group';
  const [active, setActive] = useState('internet');
  const [sending, setSending] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupSendTo, setGroupSendTo] = useState('');
  const [selectedGroupRecipients, setSelectedGroupRecipients] = useState([]);


  const todayPST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const today = todayPST;
  const yesterday = new Date(new Date(todayPST).getTime() - 86400000).toISOString().split('T')[0];
  const todayDateObj = new Date(todayPST + 'T12:00:00');
  const { start: yesterdayStart, end: yesterdayEnd } = getPeriodRange('yesterday');
  const { start: mtdStartDate, end: mtdEndDate } = getPeriodRange('mtd');

  const enabled = activeDealershipKeys.length > 0;

  // Fetch InternetLeadGroup definitions (same as VendorPerformance page)
  const storeIds = activeStores.map(s => s.id);
  const { data: allLeadGroups = [] } = useQuery({
    queryKey: ['internetLeadGroups_all', storeIds.join(',')],
    enabled: storeIds.length > 0,
    queryFn: () => Promise.all(
      storeIds.map(id => base44.entities.InternetLeadGroup.filter({ store_id: id }, 'sort_order', 200))
    ).then(results => results.flat()),
  });

  const { data: yesterdayKpi } = useLeadKpiSummary(activeDealershipKeys, yesterdayStart, yesterdayEnd, enabled);
  const { data: mtdKpi } = useLeadKpiSummary(activeDealershipKeys, mtdStartDate, mtdEndDate, enabled);
  const cmpRange = getCompareRange('mtd', 'lastMonth');
  const { data: mtdLastMonth } = useLeadKpiSummary(
    activeDealershipKeys,
    cmpRange.start,
    cmpRange.end,
    enabled
  );
  const { data: dealerRanking = [] } = useDealerRanking(activeDealershipKeys, yesterdayStart, yesterdayEnd, enabled && isGroup);
  const { data: mtdDealerRanking = [] } = useDealerRanking(activeDealershipKeys, mtdStartDate, mtdEndDate, enabled && isGroup);
  const { data: rawVendorData = [] } = useVendorSummary(activeDealershipKeys, mtdStartDate, mtdEndDate, enabled);
  const { data: leadTypeBreakdown = {} } = useLeadTypeBreakdown(activeDealershipKeys, mtdStartDate, mtdEndDate, enabled);

  // Apply same grouping as VendorPerformance page
  const vendorRows = useMemo(() =>
    buildGroupedRows(rawVendorData, allLeadGroups),
    [rawVendorData, allLeadGroups]
  );
  const { data: activityResult } = useActivityData(activeDealershipKeys, 'today', enabled);
  const { data: appointmentResult } = useAppointmentSnapshots(activeDealershipKeys, enabled);

  // Store name lookup
  const storeNameMap = {};
  activeStores.forEach(s => { storeNameMap[s.dealership_key] = s.name; });

  // Compute deltas vs last month
  const mtdSoldCompare = (mtdKpi?.total_sold ?? 0) - (mtdLastMonth?.total_sold ?? 0);
  const mtdLeadsCompare = (mtdKpi?.total_leads ?? 0) - (mtdLastMonth?.total_leads ?? 0);
  const mtdSoldPctCompare = (mtdKpi?.sold_pct ?? 0) - (mtdLastMonth?.sold_pct ?? 0);

  // Group internet performance data
  const groupInternetData = mtdKpi ? {
    yesterdayLeads: yesterdayKpi?.total_leads || 0,
    yesterdaySold: yesterdayKpi?.total_sold || 0,
    mtdLeads: mtdKpi.total_leads || 0,
    mtdSold: mtdKpi.total_sold || 0,
    mtdLeadsCompare,
    mtdSoldCompare,
    mtdSoldPctCompare,
    dealers: mtdDealerRanking.map(r => ({
      id: r.dealer_id,
      name: storeNameMap[r.dealer_id] || r.dealer_id,
      leads: r.total_leads || 0,
      sold: r.total_sold || 0,
      soldPct: r.sold_pct || 0,
    })),
    dealersYesterday: dealerRanking.map(r => ({
      id: r.dealer_id,
      name: storeNameMap[r.dealer_id] || r.dealer_id,
      leads: r.total_leads || 0,
      sold: r.total_sold || 0,
      soldPct: r.sold_pct || 0,
    })),
    vendors: vendorRows.map(v => ({
      name: v.source,
      leads: v.goodLeads,
      sold: v.sold,
      soldPct: v.soldPct,
    })),
    insights: [],
    upType: Array.isArray(leadTypeBreakdown) ? Array.from(new Set(
      leadTypeBreakdown.map(r => r.lead_type).filter(Boolean)
    )).filter(type => !['Import', 'PreviousCustomer', 'Previous Customer'].includes(type))
    .map(type => ({
      label: type,
      leads: leadTypeBreakdown.filter(r => r.lead_type === type).reduce((sum, r) => sum + r.total_leads, 0)
    })).sort((a, b) => b.leads - a.leads) : [],
    newUsed: Array.isArray(leadTypeBreakdown) ?
      ['New', 'Used'].map(inv => ({
        label: inv,
        leads: leadTypeBreakdown.filter(r => r.inventory_type === inv).reduce((sum, r) => sum + r.total_leads, 0)
      })).filter(r => r.leads > 0) : [],
    party: [
      { label: '1st Party', leads: mtdKpi?.total_leads ? Math.round(mtdKpi.total_leads * 0.35) : 0 },
      { label: '3rd Party', leads: mtdKpi?.total_leads ? Math.round(mtdKpi.total_leads * 0.65) : 0 }
    ],
  } : null;

  // Pass today's date for the email heading
  const emailDate = today;

  // Store internet performance data (single store) - NOT group data
  const storeInternetData = !isGroup && mtdKpi ? {
    dealerName: selectedLabel,
    yesterdayDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    yesterdayLeads: yesterdayKpi?.total_leads || 0,
    yesterdaySold: yesterdayKpi?.total_sold || 0,
    mtdLeads: mtdKpi.total_leads || 0,
    mtdSold: mtdKpi.total_sold || 0,
    mtdLeadsCompare,
    mtdSoldCompare,
    mtdSoldPctCompare,
    vendors: vendorRows.map(v => ({
      name: v.source,
      leads: v.goodLeads,
      sold: v.sold,
      soldPct: v.soldPct,
    })),
    upType: Array.isArray(leadTypeBreakdown) ? Array.from(new Set(
      leadTypeBreakdown.map(r => r.lead_type).filter(Boolean)
    )).filter(type => !['Import', 'PreviousCustomer', 'Previous Customer'].includes(type))
    .map(type => ({
      label: type,
      leads: leadTypeBreakdown.filter(r => r.lead_type === type).reduce((sum, r) => sum + r.total_leads, 0)
    })).sort((a, b) => b.leads - a.leads) : [],
    newUsed: Array.isArray(leadTypeBreakdown) ? 
      ['New', 'Used'].map(inv => ({
        label: inv,
        leads: leadTypeBreakdown.filter(r => r.inventory_type === inv).reduce((sum, r) => sum + r.total_leads, 0)
      })).filter(r => r.leads > 0) : [],
    party: [
      { label: '1st Party', leads: mtdKpi?.total_leads ? Math.round(mtdKpi.total_leads * 0.35) : 0 },
      { label: '3rd Party', leads: mtdKpi?.total_leads ? Math.round(mtdKpi.total_leads * 0.65) : 0 }
    ],
  } : null;

  // Activity data
  const activityRows = activityResult || [];
  // appointmentRows = individual appointment records with appointment_date + dealer_id fields
  const appointmentRows = appointmentResult?.data || [];

  // "Tomorrow" = PST today + 1 day
  const tomorrowDate = new Date(todayDateObj);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = format(tomorrowDate, 'yyyy-MM-dd');

  // Aggregate appointment counts per dealer_id
  const apptCountByDealer = {};
  appointmentRows.forEach(a => {
    const key = a.dealer_id;
    if (!key) return;
    if (!apptCountByDealer[key]) apptCountByDealer[key] = 0;
    apptCountByDealer[key] += 1;
  });

  // "Tomorrow" count per dealer
  const tomorrowCountByDealer = {};
  appointmentRows.forEach(a => {
    const key = a.dealer_id;
    if (!key) return;
    if (a.appointment_date === tomorrowStr) {
      if (!tomorrowCountByDealer[key]) tomorrowCountByDealer[key] = 0;
      tomorrowCountByDealer[key] += 1;
    }
  });

  // Aggregate activity by dealer
  const activityByDealer = {};
  activityRows.forEach(a => {
    const key = a.dealer_id || a.dealership;
    if (!activityByDealer[key]) activityByDealer[key] = { calls: 0, emails: 0, texts: 0 };
    activityByDealer[key].calls += a.calls || 0;
    activityByDealer[key].emails += a.emails || 0;
    activityByDealer[key].texts += a.texts || 0;
  });

  // Build merged dealer list from all known keys (appts + activity)
  const allDealerKeys = new Set([
    ...Object.keys(apptCountByDealer),
    ...Object.keys(activityByDealer),
  ]);
  const mergedDealers = Array.from(allDealerKeys).map(id => {
    const act = activityByDealer[id] || { calls: 0, emails: 0, texts: 0 };
    return {
      id,
      name: storeNameMap[id] || id,
      appointments: tomorrowCountByDealer[id] || 0,
      calls: act.calls,
      emails: act.emails,
      texts: act.texts,
      totalActivity: act.calls + act.emails + act.texts,
    };
  });

  const groupActivityData = {
    dealers: mergedDealers,
    alerts: [],
  };

  // Store view: build appointment days for next 7 days (PST), starting from tomorrow
  const appointmentDays = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(todayDateObj);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const count = appointmentRows.filter(a => a.appointment_date === dateStr).length;
    if (count > 0) {
      appointmentDays.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }),
        count,
      });
    }
  }

  // For store view, aggregate by salesperson (same logic as SalespersonActivity page)
  const personMap = {};
  activityRows.forEach(r => {
    const name = r.salesperson;
    if (!personMap[name]) personMap[name] = { name, calls: 0, emails: 0, texts: 0, total: 0 };
    personMap[name].calls += r.calls || 0;
    personMap[name].emails += r.emails || 0;
    personMap[name].texts += r.texts || 0;
    personMap[name].total += r.total_activity || 0;
  });

  const storeActivityData = {
    appointmentsDays: appointmentDays,
    salespeople: Object.values(personMap)
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total),
  };



  const todayDate = format(todayDateObj, 'MMMM d, yyyy');

  // Date label: "May 12 2026"
  const dateLabel = format(todayDateObj, 'MMMM d yyyy');

  // Build subject based on active tab + view type
  const getSubject = () => {
    if (active === 'activity') {
      return isGroup
        ? `Appointments & Activity - ${selectedLabel} - ${dateLabel}`
        : `Appointments & Activity - ${selectedLabel} - ${dateLabel}`;
    }
    return isGroup
      ? `Daily Lead Performance - ${selectedLabel} - ${dateLabel}`
      : `Daily Lead Performance - ${selectedLabel} - ${dateLabel}`;
  };

  // Fetch registered users and pending users for recipient picker (always fetch so pre-selection is ready)
  const { data: allRegisteredUsers = [] } = useQuery({
    queryKey: ['users_for_send'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });
  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pending_users_for_send'],
    queryFn: () => base44.entities.PendingUser.list('full_name', 500),
  });


  const toggleRecipient = (email) => {
    setSelectedRecipients(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const toggleGroupRecipient = (email) => {
    setSelectedGroupRecipients(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  // Helper to build a deduplicated recipient list from emails + name/source
  const buildRecipientList = (addFn) => {
    const emails = new Set();
    const items = [];
    const add = (email, name, source) => {
      const e = email?.trim().toLowerCase();
      if (!e || emails.has(e)) return;
      emails.add(e);
      items.push({ email: e, name: name || e, source });
    };
    addFn(add);
    return items;
  };

  // Group recipient options: principal + all store GMs + assigned users
  const EXCLUDED_EMAILS = ['emailsampark@gmail.com'];

  const groupRecipientOptions = useMemo(() => {
    if (selectedType !== 'group') return [];
    return buildRecipientList((add) => {
      if (selectedGroup?.principal_emails) {
        selectedGroup.principal_emails.split(',').forEach(e =>
          add(e.trim(), selectedGroup.principal_name || e.trim(), 'Group Principal')
        );
      }
      // Only include users explicitly assigned to the GROUP (not individual store access)
      pendingUsers.forEach(p => {
        const userGroupIds = (p.dealer_group_ids || '').split(',').map(s => s.trim()).filter(Boolean);
        if (userGroupIds.includes(String(selectedId))) {
          add(p.email, p.full_name || p.email, 'Assigned User');
        }
      });
      allRegisteredUsers.forEach(u => {
        const userGroupIds = (u.dealer_group_ids || '').split(',').map(s => s.trim()).filter(Boolean);
        if (userGroupIds.includes(String(selectedId))) {
          add(u.email, u.full_name || u.email, 'Assigned User');
        }
      });
    });
  }, [selectedGroup, selectedId, allStores, pendingUsers, allRegisteredUsers, selectedType]).filter(u => !EXCLUDED_EMAILS.includes(u.email.toLowerCase()));

  // Store recipient options: store GM + assigned users for this store
  const storeRecipientOptions = useMemo(() => {
    if (selectedType !== 'store') return [];
    const store = activeStores[0];
    if (!store) return [];
    return buildRecipientList((add) => {
      if (store.gm_emails) {
        store.gm_emails.split(',').forEach(e =>
          add(e.trim(), store.gm_name || e.trim(), 'GM')
        );
      }
      pendingUsers.forEach(p => {
        const storeIds = (p.store_ids || '').split(',').map(s => s.trim()).filter(Boolean);
        if (storeIds.includes(store.id)) add(p.email, p.full_name || p.email, 'Assigned User');
      });
      allRegisteredUsers.forEach(u => {
        const userStoreIds = (u.store_ids || '').split(',').map(s => s.trim()).filter(Boolean);
        if (userStoreIds.includes(store.id)) add(u.email, u.full_name || u.email, 'Assigned User');
      });
    });
  }, [selectedType, activeStores, pendingUsers, allRegisteredUsers]).filter(u => !EXCLUDED_EMAILS.includes(u.email.toLowerCase()));

  // The active recipient options depending on view type
  const activeRecipientOptions = isGroup ? groupRecipientOptions : storeRecipientOptions;

  const sendGroupEmail = async () => {
    const manualEmails = groupSendTo.split(',').map(e => e.trim()).filter(Boolean);
    const allRecipients = [...new Set([...selectedGroupRecipients, ...manualEmails])];
    if (allRecipients.length === 0) { toast.error('Please select or enter at least one recipient.'); return; }
    setSending(true);
    setShowGroupDialog(false);

    const previewEl = document.querySelector('[data-email-preview]');
    const html = previewEl?.innerHTML;
    if (!html) { toast.error('Could not capture preview HTML'); setSending(false); return; }

    try {
      let fnName = 'sendPreviewEmail';
      if (active === 'internet') {
        fnName = isGroup ? 'sendDailySummaryEmail' : 'sendStoreInternetEmail';
      }
      const result = await base44.functions.invoke(fnName, { to: allRecipients, subject: getSubject(), html });
      if (result?.data?.success) {
        toast.success(`Email sent to ${allRecipients.length} recipient${allRecipients.length > 1 ? 's' : ''}!`);
      } else {
        toast.error(`Failed to send: ${result?.data?.error || 'Unknown error'}`, { duration: 8000 });
      }
    } catch (err) {
      toast.error(`Failed to send: ${err.message}`, { duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  const openGroupDialog = () => {
    setGroupSendTo('');
    const opts = isGroup ? groupRecipientOptions : storeRecipientOptions;
    setSelectedGroupRecipients(opts.map(u => u.email));
    setShowGroupDialog(true);
  };

  const openSendDialog = () => {
    setSendTo('');
    setSelectedRecipients(storeRecipientOptions.map(u => u.email));
    setShowSendDialog(true);
  };

  const sendEmail = async () => {
    const manualEmails = sendTo.split(',').map(e => e.trim()).filter(Boolean);
    const allRecipients = [...new Set([...selectedRecipients, ...manualEmails])];
    if (allRecipients.length === 0) { toast.error('Please select or enter at least one recipient.'); return; }
    setSending(true);
    setShowSendDialog(false);

    // Capture rendered preview HTML
    const previewEl = document.querySelector('[data-email-preview]');
    const html = previewEl?.innerHTML;
    if (!html) { toast.error('Could not capture preview HTML'); setSending(false); return; }

    console.log('[EmailPreview] Send started:', { template: active, dealer: selectedLabel, recipients: allRecipients.length, htmlLength: html.length });

    try {
      // Route to the appropriate send function based on template type and view.
      // All functions accept { to, subject, html } — HTML is the exact rendered preview.
      let fnName = 'sendPreviewEmail';
      if (active === 'internet') {
        fnName = isGroup ? 'sendDailySummaryEmail' : 'sendStoreInternetEmail';
      }
      const result = await base44.functions.invoke(fnName, { to: allRecipients, subject: getSubject(), html });

      if (result?.data?.success) {
        toast.success(`Email sent to ${allRecipients.length} recipient${allRecipients.length > 1 ? 's' : ''}!`);
      } else {
        toast.error(`Failed to send: ${result?.data?.error || 'Unknown error'}`, { duration: 8000 });
      }
    } catch (err) {
      toast.error(`Failed to send: ${err.message}`, { duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  if (!selectedLabel) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-2">Email Templates</span>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">
              Select a store or group from the dealer selector to preview email templates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-2">Email Templates</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={active === 'internet' ? 'default' : 'outline'}
              onClick={() => setActive('internet')}
              className={active === 'internet' ? 'bg-slate-900 hover:bg-slate-800' : ''}
            >
              Internet Performance
            </Button>
            <Button
              size="sm"
              variant={active === 'activity' ? 'default' : 'outline'}
              onClick={() => setActive('activity')}
              className={active === 'activity' ? 'bg-slate-900 hover:bg-slate-800' : ''}
            >
              Appointments & Activity
            </Button>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-slate-900 hover:bg-slate-800"
              onClick={openGroupDialog}
              disabled={sending}
            >
              <Send size={13} />
              {sending ? 'Sending…' : 'Send Group'}
            </Button>
          </div>
        </div>
      </div>

      {/* Email preview — data-email-preview is used by sendEmail() to capture rendered HTML */}
      <div className="mx-auto px-6 py-8" style={{ maxWidth: '720px' }} data-email-preview>
        {active === 'internet' && isGroup && groupInternetData && (
          <InternetPerformanceEmailGroup
            groupName={selectedLabel}
            yesterdayDate={emailDate}
            {...groupInternetData}
          />
        )}
        {active === 'internet' && !isGroup && storeInternetData && (
          <InternetPerformanceEmailStore
            {...storeInternetData}
            yesterdayDate={emailDate}
          />
        )}
        {active === 'activity' && isGroup && (
          <AppointmentsActivityEmailGroup
            groupName={selectedLabel}
            reportDate={todayDate}
            {...groupActivityData}
          />
        )}
        {active === 'activity' && !isGroup && (
          <AppointmentsActivityEmailStore
            dealerName={selectedLabel}
            reportDate={todayDate}
            appointmentRows={appointmentRows}
            {...storeActivityData}
          />
        )}
        {active === 'internet' && !groupInternetData && !storeInternetData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">Loading data...</p>
          </div>
        )}
      </div>

      {/* Send dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Subject</Label>
              <p className="text-sm font-medium text-gray-800">{getSubject()}</p>
            </div>

            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Recipients</Label>
              {activeRecipientOptions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No recipients configured. Add GM emails or assign users to this store.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-50">
                  {activeRecipientOptions.map(u => (
                    <label key={u.email} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                      <Checkbox
                        checked={selectedRecipients.includes(u.email)}
                        onCheckedChange={() => toggleRecipient(u.email)}
                      />
                      <span className="font-medium text-gray-800 whitespace-nowrap">{u.name}</span>
                      <span className="text-gray-400 text-xs truncate flex-1 min-w-0">{u.name !== u.email ? u.email : ''}</span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">{u.source}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Manual input */}
            <div>
              <Label htmlFor="send-to" className="text-xs text-gray-500 mb-1 block">Or enter email manually</Label>
              <Input
                id="send-to"
                type="email"
                placeholder="recipient@example.com"
                value={sendTo}
                onChange={e => setSendTo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendEmail()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 gap-1.5" onClick={sendEmail} disabled={sending}>
              <Send size={13} /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Send Group dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Group Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Subject</Label>
              <p className="text-sm font-medium text-gray-800">{getSubject()}</p>
            </div>

            {/* Recipients */}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Recipients</Label>
              {activeRecipientOptions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No recipients configured. Add GM emails or assign users to this {isGroup ? 'group' : 'store'}.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-50">
                  {activeRecipientOptions.map(u => (
                    <label key={u.email} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                      <Checkbox
                        checked={selectedGroupRecipients.includes(u.email)}
                        onCheckedChange={() => toggleGroupRecipient(u.email)}
                      />
                      <span className="font-medium text-gray-800 whitespace-nowrap">{u.name}</span>
                      <span className="text-gray-400 text-xs truncate flex-1 min-w-0">{u.name !== u.email ? u.email : ''}</span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">{u.source}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Manual input */}
            <div>
              <Label htmlFor="group-send-to" className="text-xs text-gray-500 mb-1 block">Or enter email manually</Label>
              <Input
                id="group-send-to"
                type="email"
                placeholder="recipient@example.com"
                value={groupSendTo}
                onChange={e => setGroupSendTo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendGroupEmail()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowGroupDialog(false)}>Cancel</Button>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 gap-1.5" onClick={sendGroupEmail} disabled={sending}>
              <Send size={13} /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}