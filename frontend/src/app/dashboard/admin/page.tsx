'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { getAdminDashboard, getAdminUsers, toggleUserActive, updateUserPlan, updateUserRole } from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Shield, Users, Globe, Bell, Activity, ChevronDown } from 'lucide-react';

const PLANS = ['free', 'starter', 'pro', 'enterprise'];
const ROLES = ['user', 'admin', 'super_admin'];

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
};

const roleColors: Record<string, string> = {
  user: 'bg-gray-100 text-gray-600',
  admin: 'bg-blue-50 text-blue-700',
  super_admin: 'bg-red-50 text-red-700',
};

export default function AdminPage() {
  const user = useStore((s) => s.user);
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      router.replace('/dashboard');
      return;
    }

    Promise.all([
      getAdminDashboard().then((r) => setDashboard(r.data)),
      getAdminUsers().then((r) => setUsers(r.data.users || r.data)),
    ])
      .catch((err) => {
        if (err.response?.status === 403) {
          toast.error('Access denied. Super Admin only.');
          router.replace('/dashboard');
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleToggleActive = async (userId: string) => {
    try {
      await toggleUserActive(userId);
      setUsers(users.map((u) => u.id === userId ? { ...u, isActive: !u.isActive } : u));
      toast.success('User status updated');
    } catch {
      toast.error('Failed to update user status');
    }
  };

  const handlePlanChange = async (userId: string, plan: string) => {
    try {
      await updateUserPlan(userId, plan);
      setUsers(users.map((u) => u.id === userId ? { ...u, plan } : u));
      setEditingPlan(null);
      toast.success(`Plan updated to ${plan}`);
    } catch {
      toast.error('Failed to update plan');
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      setUsers(users.map((u) => u.id === userId ? { ...u, role } : u));
      setEditingRole(null);
      toast.success(`Role updated to ${role}`);
    } catch {
      toast.error('Failed to update role');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;

  const stats = dashboard?.stats || {};

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-7 w-7 text-red-600" />
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Panel</h1>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: formatNumber(stats.totalUsers || 0), icon: Users, color: 'text-blue-600' },
          { label: 'Total Sites', value: formatNumber(stats.totalSites || 0), icon: Globe, color: 'text-green-600' },
          { label: 'Subscribers', value: formatNumber(stats.totalSubscribers || 0), icon: Activity, color: 'text-purple-600' },
          { label: 'Notifications', value: formatNumber(stats.totalNotifications || 0), icon: Bell, color: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{s.label}</p>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Plan Limits Reference */}
      <div className="bg-white rounded-xl border mb-8 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold">Plan Limits</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-500">Plan</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">Sites</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">Subscribers</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">Notifications/mo</th>
              <th className="text-left px-4 py-2 font-medium text-gray-500">Features</th>
            </tr>
          </thead>
          <tbody>
            {[
              { plan: 'free', sites: '1', subs: '1,000', notifs: '100', features: 'Basic Notifications, Widget' },
              { plan: 'starter', sites: '3', subs: '10,000', notifs: '1,000', features: '+ Segments, Automations' },
              { plan: 'pro', sites: '10', subs: '100,000', notifs: '10,000', features: '+ A/B Testing, Analytics' },
              { plan: 'enterprise', sites: 'Unlimited', subs: 'Unlimited', notifs: 'Unlimited', features: '+ White Label, API Access' },
            ].map((p) => (
              <tr key={p.plan} className="border-b last:border-0">
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${planColors[p.plan]}`}>{p.plan}</span></td>
                <td className="px-4 py-2">{p.sites}</td>
                <td className="px-4 py-2">{p.subs}</td>
                <td className="px-4 py-2">{p.notifs}</td>
                <td className="px-4 py-2 text-gray-500">{p.features}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Users Management Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold">User Management</h2>
          <span className="text-sm text-gray-500">{users.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingRole === u.id ? (
                      <select
                        defaultValue={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        onBlur={() => setEditingRole(null)}
                        autoFocus
                        className="text-xs border rounded px-2 py-1"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingRole(u.id)}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${roleColors[u.role] || roleColors.user}`}
                      >
                        {u.role} <ChevronDown className="inline h-3 w-3" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingPlan === u.id ? (
                      <select
                        defaultValue={u.plan}
                        onChange={(e) => handlePlanChange(u.id, e.target.value)}
                        onBlur={() => setEditingPlan(null)}
                        autoFocus
                        className="text-xs border rounded px-2 py-1"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingPlan(u.id)}
                        className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${planColors[u.plan] || planColors.free}`}
                      >
                        {u.plan} <ChevronDown className="inline h-3 w-3" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(u.id)}
                      className={`text-xs px-3 py-1 rounded border ${u.isActive ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
