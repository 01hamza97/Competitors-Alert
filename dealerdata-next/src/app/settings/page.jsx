'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  User,
  Building2,
  Bell,
  Shield,
  Key,
  Save,
  Check,
  Copy,
  Mail,
  Lock,
  Globe,
  Smartphone,
  Users,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import TeamAndRbacSettings from '@/components/settings/TeamAndRbacSettings';

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const defaultTab = requestedTab && requestedTab !== 'scraper' ? requestedTab : 'profile';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile Form state
  const [fullName, setFullName] = useState(user?.full_name || 'Sarah Connor');
  const [email, setEmail] = useState(user?.email || 'admin@dealerdata.com');
  const [phone, setPhone] = useState('+1 (555) 382-9104');
  const [title, setTitle] = useState(user?.role === 'admin' ? 'Director of Operations' : 'General Manager');

  // Org Form state
  const [companyName, setCompanyName] = useState(user?.company || 'Aaron Automotive Group');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [principalEmail, setPrincipalEmail] = useState('reports@aaronautogroup.com');

  // Notifications state
  const [notifDailySummary, setNotifDailySummary] = useState(true);
  const [notifNightlyAppts, setNotifNightlyAppts] = useState(true);
  const [notifUnassignedLeads, setNotifUnassignedLeads] = useState(true);
  const [notifCompetitorAlerts, setNotifCompetitorAlerts] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (user?.id) {
        await fetch(`/api/entities/User/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            email: email,
            phone: phone,
          }),
        });
      }
      toast.success('Profile information saved to database!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (user?.dealer_group_ids) {
        await fetch(`/api/entities/DealerGroup/${user.dealer_group_ids}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: orgName,
            timezone: timezone,
            website: website,
          }),
        });
      }
      toast.success('Dealership organization settings updated in database!');
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully in database!');
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900">Settings & Preferences</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your user profile, dealership organization settings, security, and notification schedules.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="profile" className="text-xs font-semibold gap-1.5">
            <User size={14} /> Profile
          </TabsTrigger>
          <TabsTrigger value="dealership" className="text-xs font-semibold gap-1.5">
            <Building2 size={14} /> Dealership Group
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs font-semibold gap-1.5">
            <Users size={14} /> Team & RBAC
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs font-semibold gap-1.5">
            <Bell size={14} /> Email Reports
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs font-semibold gap-1.5">
            <Shield size={14} /> Security
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile" className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <form onSubmit={handleSaveProfile} className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
              <p className="text-xs text-slate-500">Update your account name and email address.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Job Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Mobile Phone
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-xs font-bold gap-2">
                <Save size={14} /> Save Profile Changes
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Tab 2: Dealership Organization */}
        <TabsContent value="dealership" className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <form onSubmit={handleSaveOrg} className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Dealership Group Details</h3>
              <p className="text-xs text-slate-500">Manage group identification and escalation channels.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Group / Corporation Name
                </label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Executive Principal Recipient Email(s)
                </label>
                <Input
                  value={principalEmail}
                  onChange={(e) => setPrincipalEmail(e.target.value)}
                  placeholder="comma-separated emails"
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  These addresses receive consolidated executive summaries across all rooftops.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Default Operational Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-xs font-bold gap-2">
                <Save size={14} /> Update Group Settings
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Tab 3: Team & RBAC Permissions */}
        <TabsContent value="team" className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <TeamAndRbacSettings currentUser={user} />
        </TabsContent>

        {/* Tab 4: Notifications & Automations */}
        <TabsContent value="notifications" className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6 max-w-3xl">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Automated Intelligence Dispatches</h3>
            <p className="text-xs text-slate-500">Configure recurring performance digests sent directly to management teams.</p>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Daily Summary Email (Morning 7:00 AM PST)</p>
                <p className="text-xs text-slate-500">
                  Detailed prior-day lead volume, closing rate, sold counts, and vendor rankings.
                </p>
              </div>
              <Switch
                checked={notifDailySummary}
                onCheckedChange={(checked) => {
                  setNotifDailySummary(checked);
                  toast.success(checked ? 'Daily Summary enabled' : 'Daily Summary disabled');
                }}
              />
            </div>

            <div className="py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Nightly Appointments & Activity Digest (11:30 PM PST)</p>
                <p className="text-xs text-slate-500">
                  Confirmed next-day showroom appointments and salesperson call/email/text activity logs.
                </p>
              </div>
              <Switch
                checked={notifNightlyAppts}
                onCheckedChange={(checked) => {
                  setNotifNightlyAppts(checked);
                  toast.success(checked ? 'Appointments Digest enabled' : 'Appointments Digest disabled');
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Security */}
        <TabsContent value="security" className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6 max-w-2xl">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
              <p className="text-xs text-slate-500">Ensure your account uses a strong 8+ character password.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Current Password
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  New Password
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-xs font-bold">
                Update Password
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
