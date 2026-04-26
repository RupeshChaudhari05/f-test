'use client';

import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import {
  getDashboard,
  getGeoBreakdown,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getOsBreakdown,
  getSubscriberGrowth,
  getNotifications,
} from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import {
  Globe, Monitor, Smartphone, Tablet, TrendingUp, Users,
  Bell, MousePointerClick, CheckCircle2, AlertCircle, BarChart2,
} from 'lucide-react';

const COLORS = [
  '#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

interface GeoRow    { country: string; count: number; percentage: number }
interface DeviceRow { deviceType: string; count: number; percentage: number }
interface BrowRow   { browser: string; count: number; percentage: number }
interface OsRow     { os: string; count: number; percentage: number }
interface GrowthRow { date: string; newSubscribers: number; totalActive: number }
interface NotifRow {
  id: string; title: string; status: string;
  totalSent: number; totalDelivered: number; totalClicked: number;
  totalFailed: number; createdAt: string; sentAt: string | null;
}

const DEVICE_ICON: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-4 w-4" />,
  mobile:  <Smartphone className="h-4 w-4" />,
  tablet:  <Tablet className="h-4 w-4" />,
};

const statusVariant: Record<string, string> = {
  sent: 'success', sending: 'warning', scheduled: 'default',
  draft: 'secondary', failed: 'destructive', cancelled: 'secondary',
};

const TABS = ['Overview', 'Notifications', 'Audience'] as const;
type Tab = typeof TABS[number];

const notifCols: ColumnDef<NotifRow>[] = [
  { key: 'title', header: 'Title', render: (r) => <span className="font-medium line-clamp-1 max-w-xs">{r.title}</span>, accessorFn: (r) => r.title },
  { key: 'status', header: 'Status', render: (r) => <Badge variant={(statusVariant[r.status] ?? 'secondary') as any} className="capitalize text-xs">{r.status}</Badge>, accessorFn: (r) => r.status },
  { key: 'totalSent', header: 'Sent', render: (r) => r.totalSent.toLocaleString(), accessorFn: (r) => r.totalSent },
  { key: 'totalDelivered', header: 'Delivered', render: (r) => r.totalDelivered.toLocaleString(), accessorFn: (r) => r.totalDelivered },
  {
    key: 'ctr', header: 'CTR',
    render: (r) => {
      const v = r.totalSent > 0 ? (r.totalClicked / r.totalSent) * 100 : null;
      return <span className={v === null ? 'text-muted-foreground' : v >= 5 ? 'text-green-600 font-semibold' : v >= 2 ? 'text-amber-600' : 'text-muted-foreground'}>{v !== null ? v.toFixed(1) + '%' : '—'}</span>;
    },
    accessorFn: (r) => r.totalSent > 0 ? (r.totalClicked / r.totalSent) * 100 : 0,
  },
  {
    key: 'deliveryRate', header: 'Delivery Rate',
    render: (r) => <span className="text-muted-foreground">{r.totalSent > 0 ? ((r.totalDelivered / r.totalSent) * 100).toFixed(1) + '%' : '—'}</span>,
    accessorFn: (r) => r.totalSent > 0 ? (r.totalDelivered / r.totalSent) * 100 : 0,
  },
  { key: 'totalFailed', header: 'Failed', render: (r) => <span className={r.totalFailed > 0 ? 'text-red-500' : 'text-muted-foreground'}>{r.totalFailed.toLocaleString()}</span>, accessorFn: (r) => r.totalFailed },
  { key: 'sentAt', header: 'Date', render: (r) => <span className="text-xs text-muted-foreground">{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}</span>, accessorFn: (r) => r.sentAt ?? '' },
];

export default function AnalyticsPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [tab,  setTab]     = useState<Tab>('Overview');
  const [days, setDays]    = useState<7 | 30 | 90>(30);

  const [dashData,  setDashData]  = useState<any>(null);
  const [geo,       setGeo]       = useState<GeoRow[]>([]);
  const [devices,   setDevices]   = useState<DeviceRow[]>([]);
  const [browsers,  setBrowsers]  = useState<BrowRow[]>([]);
  const [os,        setOs]        = useState<OsRow[]>([]);
  const [growth,    setGrowth]    = useState<GrowthRow[]>([]);
  const [notifs,    setNotifs]    = useState<NotifRow[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!currentSite) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getDashboard(currentSite.id, { days }).then((r) => setDashData(r.data)),
      getGeoBreakdown(currentSite.id, 20).then((r) => setGeo(r.data)),
      getDeviceBreakdown(currentSite.id).then((r) => setDevices(r.data)),
      getBrowserBreakdown(currentSite.id).then((r) => setBrowsers(r.data)),
      getOsBreakdown(currentSite.id).then((r) => setOs(r.data)),
      getSubscriberGrowth(currentSite.id, days).then((r) => setGrowth(r.data)),
      getNotifications(currentSite.id).then((r) => setNotifs(r.data.notifications || r.data || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [currentSite, days]);

  const kpis = useMemo(() => {
    const stats = dashData?.stats ?? {};
    const sent = notifs.filter((n) => n.totalSent > 0);
    const avgCtr = sent.length ? sent.reduce((s, n) => s + (n.totalClicked / n.totalSent) * 100, 0) / sent.length : null;
    const avgDel = sent.length ? sent.reduce((s, n) => s + (n.totalDelivered / n.totalSent) * 100, 0) / sent.length : null;
    return {
      totalSubscribers: stats.totalSubscribers ?? 0,
      activeSubscribers: stats.activeSubscribers ?? 0,
      notificationsSent: stats.notificationsSent ?? notifs.filter((n) => n.status === 'sent').length,
      avgCtr, avgDel,
    };
  }, [dashData, notifs]);

  if (!currentSite) return (
    <div className="flex justify-center py-20 text-muted-foreground">Select a site to view analytics.</div>
  );

  return (
    <div className="space-y-6">
      {/* Header + Range picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance insights for <strong>{currentSite.name}</strong></p>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {([7, 30, 90] as const).map((r) => (
            <button key={r} onClick={() => setDays(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${days === r ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <>
          {/* OVERVIEW */}
          {tab === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard icon={<Users className="h-4 w-4" />} label="Total Subscribers" value={kpis.totalSubscribers.toLocaleString()} color="text-blue-600" />
                <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Active Subscribers" value={kpis.activeSubscribers.toLocaleString()} sub={kpis.totalSubscribers > 0 ? `${((kpis.activeSubscribers / kpis.totalSubscribers) * 100).toFixed(0)}% active` : undefined} color="text-green-600" />
                <KpiCard icon={<Bell className="h-4 w-4" />} label="Campaigns Sent" value={kpis.notificationsSent.toLocaleString()} color="text-violet-600" />
                <KpiCard icon={<MousePointerClick className="h-4 w-4" />} label="Avg. CTR" value={kpis.avgCtr !== null ? `${kpis.avgCtr.toFixed(1)}%` : '—'} sub="benchmark: 2–5%" color="text-amber-600" />
                <KpiCard icon={<BarChart2 className="h-4 w-4" />} label="Avg. Delivery" value={kpis.avgDel !== null ? `${kpis.avgDel.toFixed(1)}%` : '—'} color="text-cyan-600" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Subscriber Growth</CardTitle>
                  <CardDescription>New and total active subscribers — last {days} days</CardDescription>
                </CardHeader>
                <CardContent>
                  {growth.length === 0 ? <EmptyState message="No growth data yet." /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={growth}>
                        <defs>
                          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip /><Legend />
                        <Area type="monotone" dataKey="newSubscribers" stroke="#4F46E5" fill="url(#g1)" name="New" />
                        <Area type="monotone" dataKey="totalActive" stroke="#10B981" fill="url(#g2)" name="Total Active" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {notifs.filter((n) => n.status === 'sent' && n.totalSent > 0).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Top Campaigns (by CTR)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <DataTable
                      columns={notifCols.slice(0, 5)}
                      data={[...notifs].filter((n) => n.status === 'sent' && n.totalSent > 0)
                        .sort((a, b) => (b.totalClicked / b.totalSent) - (a.totalClicked / a.totalSent)).slice(0, 5)}
                      rowKey={(r) => r.id}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* NOTIFICATIONS */}
          {tab === 'Notifications' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Campaigns', value: notifs.length },
                  { label: 'Sent', value: notifs.filter((n) => n.status === 'sent').length },
                  { label: 'Scheduled', value: notifs.filter((n) => n.status === 'scheduled').length },
                  { label: 'Drafts', value: notifs.filter((n) => n.status === 'draft').length },
                ].map((s) => (
                  <Card key={s.label}><CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </CardContent></Card>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Campaigns</CardTitle>
                  <CardDescription>Click any column to sort. CTR benchmark: 2–5%.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <DataTable columns={notifCols} data={notifs} rowKey={(r) => r.id} searchable searchPlaceholder="Search by title or status…" emptyMessage="No notifications yet." />
                </CardContent>
              </Card>

              {notifs.filter((n) => n.totalSent > 0).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">CTR by Campaign</CardTitle><CardDescription>Last {notifs.filter((n) => n.totalSent > 0).length} campaigns</CardDescription></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={notifs.filter((n) => n.totalSent > 0).slice(-20).map((n) => ({ title: n.title.slice(0, 18), ctr: parseFloat(((n.totalClicked / n.totalSent) * 100).toFixed(2)) }))} margin={{ top: 4, right: 12, bottom: 40, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="title" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'CTR']} />
                        <Bar dataKey="ctr" name="CTR" radius={[4, 4, 0, 0]}>
                          {notifs.filter((n) => n.totalSent > 0).slice(-20).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* AUDIENCE */}
          {tab === 'Audience' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-primary" /> By Country</CardTitle><CardDescription>Top 20 countries</CardDescription></CardHeader>
                  <CardContent>
                    {geo.length === 0 ? <EmptyState message="No geographic data yet." /> : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {geo.map((row, i) => (
                          <div key={row.country} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                            <span className="text-sm font-medium w-14">{countryFlag(row.country)} {row.country}</span>
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div className="h-2 rounded-full" style={{ width: `${row.percentage}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-20 text-right">{row.count.toLocaleString()} ({row.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Monitor className="h-4 w-4 text-primary" /> By Device</CardTitle></CardHeader>
                  <CardContent>
                    {devices.length === 0 ? <EmptyState message="No device data yet." /> : (
                      <div className="flex flex-col items-center gap-4">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={devices} dataKey="count" nameKey="deviceType" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                              {devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => v.toLocaleString()} /><Legend />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-3 gap-3 w-full">
                          {devices.map((row, i) => (
                            <div key={row.deviceType} className="text-center p-3 rounded-lg bg-muted/50">
                              <div className="flex justify-center mb-1 text-muted-foreground">{DEVICE_ICON[row.deviceType] ?? <Monitor className="h-4 w-4" />}</div>
                              <p className="text-sm font-semibold capitalize">{row.deviceType}</p>
                              <p className="text-xs text-muted-foreground">{row.percentage}%</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">By Browser</CardTitle></CardHeader>
                  <CardContent>
                    {browsers.length === 0 ? <EmptyState message="No browser data yet." /> : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={browsers} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="browser" type="category" tick={{ fontSize: 11 }} width={80} />
                          <Tooltip formatter={(v: number) => v.toLocaleString()} />
                          <Bar dataKey="count" name="Subscribers" radius={[0, 4, 4, 0]}>
                            {browsers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">By OS</CardTitle></CardHeader>
                  <CardContent>
                    {os.length === 0 ? <EmptyState message="No OS data yet." /> : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={os} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="os" type="category" tick={{ fontSize: 11 }} width={80} />
                          <Tooltip formatter={(v: number) => v.toLocaleString()} />
                          <Bar dataKey="count" name="Subscribers" radius={[0, 4, 4, 0]}>
                            {os.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card><CardContent className="pt-4 pb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className={color}>{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent></Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
      <AlertCircle className="h-8 w-8 opacity-30" />
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  const offset = 127397;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}
