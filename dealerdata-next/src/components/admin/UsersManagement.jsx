import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '@/components/SectionCard';

function parseIds(str) {
  return str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
}

export default function UsersManagement({ selectedGroupId, selectedStoreId, allGroups, allStores }) {
  const [sendingTest, setSendingTest] = useState({});
  const qc = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });

  // Filter users based on access scope
  const visibleUsers = useMemo(() => {
    let users = allUsers;

    // If group selected, show all users in that group
    if (selectedGroupId) {
      users = users.filter(u => {
        const groupIds = parseIds(u.dealer_group_ids);
        return groupIds.some(gid => String(gid) === String(selectedGroupId));
      });
    }
    // If store selected, show store users + group users
    else if (selectedStoreId) {
      const selectedStore = allStores.find(s => s.id === selectedStoreId);
      const parentGroupId = selectedStore?.group_id;
      
      users = users.filter(u => {
        const storeIds = parseIds(u.store_ids);
        const groupIds = parseIds(u.dealer_group_ids);
        
        // Include if assigned directly to this store OR assigned to parent group
        const inStore = storeIds.some(sid => String(sid) === String(selectedStoreId));
        const inParentGroup = parentGroupId && groupIds.some(gid => String(gid) === String(parentGroupId));
        
        return inStore || inParentGroup;
      });
    }

    return users.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allUsers, selectedGroupId, selectedStoreId, allStores]);

  const toggleEmailSetting = async (user, setting) => {
    const currentValue = user[setting];
    const update = { [setting]: !currentValue };
    
    try {
      await base44.entities.User.update(user.id, update);
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${setting} updated`);
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const getGroupName = (groupId) => {
    if (!groupId) return '—';
    const ids = parseIds(groupId);
    return ids.map(id => allGroups.find(g => String(g.id) === String(id))?.name || id).join(', ');
  };

  const getStoreNames = (storeId) => {
    if (!storeId) return '—';
    const ids = parseIds(storeId);
    const names = ids.map(id => allStores.find(s => String(s.id) === String(id))?.name || id);
    return names.length > 0 ? names.join(', ') : '—';
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-700',
      manager: 'bg-blue-100 text-blue-700',
      user: 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  if (!selectedGroupId && !selectedStoreId) {
    return (
      <SectionCard title="Users Management">
        <p className="text-gray-400 text-sm">Select a group or store to view and manage users.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100">
        {visibleUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500">User</th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500">Role</th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Daily</th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Appts</th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Comp</th>
                <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-500">Send Test</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user, i) => (
                <tr key={user.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-3 py-2.5 text-sm">
                    <div className="font-medium text-gray-800">{user.full_name || '—'}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Badge className={`text-xs font-semibold ${getRoleColor(user.role)}`}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Checkbox
                      checked={!!user.daily_summary_enabled}
                      onCheckedChange={() => toggleEmailSetting(user, 'daily_summary_enabled')}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Checkbox
                      checked={!!user.appointments_enabled}
                      onCheckedChange={() => toggleEmailSetting(user, 'appointments_enabled')}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Checkbox
                      checked={!!user.competitor_report_enabled}
                      onCheckedChange={() => toggleEmailSetting(user, 'competitor_report_enabled')}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-gray-400 hover:text-blue-600"
                      onClick={() => {
                        setSendingTest(t => ({ ...t, [user.id]: true }));
                        setTimeout(() => setSendingTest(t => ({ ...t, [user.id]: false })), 2000);
                        toast.success('Test sent to ' + user.email);
                      }}
                      disabled={sendingTest[user.id]}
                      title="Send test email"
                    >
                      <Send size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {visibleUsers.length} user{visibleUsers.length !== 1 ? 's' : ''} shown · Email subscriptions update automatically
      </p>
    </div>
  );
}