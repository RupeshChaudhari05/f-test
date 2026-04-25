'use client';

import { useEffect, useState } from 'react';
import { getAdminDashboard } from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Globe, Bell, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const planColors: Record<string, string> = {
  free: 'secondary',
  starter: 'default',
  pro: 'warning',
  enterprise: 'success',
};

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide statistics and recent activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Clients', value: formatNumber(stats.totalUsers || 0), icon: Users, color: 'text-blue-600' },
          { label: 'Total Sites', value: formatNumber(stats.totalSites || 0), icon: Globe, color: 'text-green-600' },
          { label: 'Active Subscribers', value: formatNumber(stats.totalSubscribers || 0), icon: Activity, color: 'text-purple-600' },
          { label: 'Notifications Sent', value: formatNumber(stats.totalNotifications || 0), icon: Bell, color: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Clients */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Clients</CardTitle>
            <Link
              href="/super-admin/clients"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Plan</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u: any) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/super-admin/clients/${u.id}`} className="hover:text-primary hover:underline">
                        {u.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={(planColors[u.plan] as any) ?? 'secondary'} className="capitalize text-xs">
                        {u.plan}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? 'success' : 'destructive'} className="text-xs">
                        {u.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(u.createdAt)}</td>
                  </tr>
                ))}
                {recentUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No clients yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
