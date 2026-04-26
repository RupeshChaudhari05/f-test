'use client';

import { useEffect, useState } from 'react';
import { getAdminDashboard } from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Users, Globe, Bell, Activity, ArrowRight, DollarSign, ShieldCheck } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Link from 'next/link';

const planColors: Record<string, string> = {
  free: 'secondary', starter: 'default', pro: 'warning', enterprise: 'success',
};
const PIE_COLORS = ['#94A3B8', '#4F46E5', '#F59E0B', '#10B981'];
const PLAN_MRR: Record<string, number> = { free: 0, starter: 29, pro: 79, enterprise: 249 };

export default function SuperAdminOverviewPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminDashboard()
      .then((r) => setDashboard(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-destructive" />
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const recentUsers = dashboard?.recentUsers || [];

  // Derived metrics
  const planDist: Record<string, number> = {};
  recentUsers.forEach((u: any) => { planDist[u.plan] = (planDist[u.plan] || 0) + 1; });
  const planPieData = Object.entries(planDist).map(([name, value]) => ({ name, value }));
  const mrr = recentUsers.reduce((s: number, u: any) => s + (PLAN_MRR[u.plan] || 0), 0);
  const activeCount = recentUsers.filter((u: any) => u.isActive).length;

  const clientCols = [
    { key: 'name', header: 'Name', render: (u: any) => <Link href={`/super-admin/clients/${u.id}`} className="font-medium hover:text-primary hover:underline">{u.name}</Link>, accessorFn: (u: any) => u.name },
    { key: 'email', header: 'Email', render: (u: any) => <span className="text-muted-foreground text-xs">{u.email}</span>, accessorFn: (u: any) => u.email },
    { key: 'plan', header: 'Plan', render: (u: any) => <Badge variant={(planColors[u.plan] as any) ?? 'secondary'} className="capitalize text-xs">{u.plan}</Badge>, accessorFn: (u: any) => u.plan },
    { key: 'isActive', header: 'Status', render: (u: any) => <Badge variant={u.isActive ? 'success' : 'destructive'} className="text-xs">{u.isActive ? 'Active' : 'Suspended'}</Badge>, accessorFn: (u: any) => u.isActive ? 'active' : 'suspended' },
    { key: 'sitesCount', header: 'Sites', render: (u: any) => u.sitesCount ?? 0, accessorFn: (u: any) => u.sitesCount ?? 0 },
    { key: 'createdAt', header: 'Joined', render: (u: any) => <span className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</span>, accessorFn: (u: any) => u.createdAt },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide statistics and recent activity</p>
      </div>

      {/* Core Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: formatNumber(stats.totalUsers || 0), icon: Users, color: 'text-blue-600' },
          { label: 'Total Sites', value: formatNumber(stats.totalSites || 0), icon: Globe, color: 'text-green-600' },
          { label: 'Active Subscribers', value: formatNumber(stats.totalSubscribers || 0), icon: Activity, color: 'text-purple-600' },
          { label: 'Notifications Sent', value: formatNumber(stats.totalNotifications || 0), icon: Bell, color: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue + Health + Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Est. Monthly Revenue</p>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">${mrr.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Based on {recentUsers.length} loaded clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Client Health</p>
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{recentUsers.length > 0 ? Math.round((activeCount / recentUsers.length) * 100) : 0}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{activeCount} active of {recentUsers.length} shown</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Plan Distribution</CardTitle></CardHeader>
          <CardContent>
            {planPieData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No client data</p>
            ) : (
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={planPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40}>
                    {planPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-3">
        <Link href="/super-admin/clients" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          Manage Clients <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/super-admin/sites" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          All Sites <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Recent Clients — sortable DataTable */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Clients</CardTitle>
            <Link href="/super-admin/clients" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <CardDescription>Click any column header to sort. Click Name to view client detail.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={clientCols as any}
            data={recentUsers}
            rowKey={(u: any) => u.id}
            searchable
            searchPlaceholder="Search clients..."
            emptyMessage="No clients yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
