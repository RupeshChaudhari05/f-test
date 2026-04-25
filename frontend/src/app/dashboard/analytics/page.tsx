'use client';

/**
 * Advanced Analytics Page
 * =======================
 * Displays geographic, device, browser, and OS breakdowns for site subscribers,
 * plus a daily subscriber growth chart.
 *
 * All data comes from the new analytics endpoints added in v2:
 *   GET /api/v1/sites/:siteId/analytics/geo
 *   GET /api/v1/sites/:siteId/analytics/devices
 *   GET /api/v1/sites/:siteId/analytics/browsers
 *   GET /api/v1/sites/:siteId/analytics/os
 *   GET /api/v1/sites/:siteId/analytics/growth
 */

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  getGeoBreakdown,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getOsBreakdown,
  getSubscriberGrowth,
} from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Monitor, Smartphone, Tablet, Chrome, TrendingUp } from 'lucide-react';

// Colour palette for charts
const COLORS = [
  '#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

interface GeoRow    { country: string; count: number; percentage: number }
interface DeviceRow { deviceType: string; count: number; percentage: number }
interface BrowRow   { browser: string; count: number; percentage: number }
interface OsRow     { os: string; count: number; percentage: number }
interface GrowthRow { date: string; newSubscribers: number; totalActive: number }

const DEVICE_ICON: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-4 w-4" />,
  mobile:  <Smartphone className="h-4 w-4" />,
  tablet:  <Tablet className="h-4 w-4" />,
};

export default function AdvancedAnalyticsPage() {
  const currentSite = useStore((s) => s.currentSite);

  const [geo,     setGeo]     = useState<GeoRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [browsers, setBrowsers] = useState<BrowRow[]>([]);
  const [os,      setOs]      = useState<OsRow[]>([]);
  const [growth,  setGrowth]  = useState<GrowthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSite) { setLoading(false); return; }

    setLoading(true);
    Promise.all([
      getGeoBreakdown(currentSite.id, 20).then((r) => setGeo(r.data)),
      getDeviceBreakdown(currentSite.id).then((r) => setDevices(r.data)),
      getBrowserBreakdown(currentSite.id).then((r) => setBrowsers(r.data)),
      getOsBreakdown(currentSite.id).then((r) => setOs(r.data)),
      getSubscriberGrowth(currentSite.id, 30).then((r) => setGrowth(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentSite]);

  if (!currentSite) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        Select a site to view analytics.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Advanced Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Geographic, device, and growth insights for <strong>{currentSite.name}</strong>
        </p>
      </div>

      {/* Subscriber Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Subscriber Growth (Last 30 days)
          </CardTitle>
          <CardDescription>New subscribers added per day</CardDescription>
        </CardHeader>
        <CardContent>
          {growth.length === 0 ? (
            <EmptyState message="No growth data available yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="newSubscribers"
                  stroke="#4F46E5"
                  fill="url(#growthGrad)"
                  name="New Subscribers"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-column row: Geo + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Geographic breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Subscribers by Country
            </CardTitle>
            <CardDescription>Top 20 countries</CardDescription>
          </CardHeader>
          <CardContent>
            {geo.length === 0 ? (
              <EmptyState message="No geographic data available yet." />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {geo.map((row, i) => (
                  <div key={row.country} className="flex items-center gap-3">
                    {/* Rank */}
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    {/* Flag emoji + country code */}
                    <span className="text-sm font-medium w-12">
                      {countryFlag(row.country)} {row.country}
                    </span>
                    {/* Progress bar */}
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${row.percentage}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {row.count.toLocaleString()} ({row.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              Subscribers by Device
            </CardTitle>
            <CardDescription>Desktop, mobile, and tablet split</CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <EmptyState message="No device data available yet." />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={devices}
                      dataKey="count"
                      nameKey="deviceType"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {devices.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-3 w-full">
                  {devices.map((row, i) => (
                    <div key={row.deviceType} className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="flex justify-center mb-1 text-muted-foreground">
                        {DEVICE_ICON[row.deviceType] ?? <Monitor className="h-4 w-4" />}
                      </div>
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

      {/* Two-column row: Browsers + OS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Browser breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Chrome className="h-5 w-5 text-primary" />
              Subscribers by Browser
            </CardTitle>
          </CardHeader>
          <CardContent>
            {browsers.length === 0 ? (
              <EmptyState message="No browser data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={browsers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="browser" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="count" name="Subscribers" radius={[0, 4, 4, 0]}>
                    {browsers.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* OS breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              Subscribers by OS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {os.length === 0 ? (
              <EmptyState message="No OS data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={os} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="os" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="count" name="Subscribers" radius={[0, 4, 4, 0]}>
                    {os.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
      <TrendingUp className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/**
 * Convert a 2-letter ISO country code to a flag emoji.
 * Works in all modern browsers by using Regional Indicator Symbols.
 */
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  const offset = 127397; // codePoint of 🇦 minus charCode of A
  return String.fromCodePoint(
    code.charCodeAt(0) + offset,
    code.charCodeAt(1) + offset,
  );
}
