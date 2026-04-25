'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { getDashboard } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { Users, Send, MousePointerClick, TrendingUp, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface DashboardData {
  totalSubscribers: number;
  totalNotifications: number;
  totalDelivered: number;
  totalClicked: number;
  ctr: number;
  dailyStats: { date: string; subscribers: number; delivered: number; clicked: number }[];
}

export default function DashboardPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSite) { setLoading(false); return; }
    setLoading(true);
    getDashboard(currentSite.id)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentSite]);

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-2 p-3 bg-muted rounded-full w-fit">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Welcome to Posh Push</CardTitle>
            <CardDescription>Create your first site to start sending push notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/sites/new">
              <Button className="w-full">
                <Globe className="h-4 w-4 mr-2" /> Create Your First Site
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const stats = [
    { label: 'Subscribers', value: formatNumber(data?.totalSubscribers || 0), icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Sent', value: formatNumber(data?.totalNotifications || 0), icon: Send, color: 'text-green-600 bg-green-50' },
    { label: 'Delivered', value: formatNumber(data?.totalDelivered || 0), icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
    { label: 'CTR', value: `${(data?.ctr || 0).toFixed(1)}%`, icon: MousePointerClick, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">{currentSite.name} overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {typeof window !== 'undefined' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.dailyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="delivered" stroke="#6366f1" fill="#e0e7ff" name="Delivered" />
                  <Area type="monotone" dataKey="clicked" stroke="#f59e0b" fill="#fef3c7" name="Clicked" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full bg-muted/20 rounded animate-pulse" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
