'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getAdminClientDetail, suspendClient, reactivateClient, updateUserPlan, setPlanExpiry,
  getAdminSiteNotifications, getAdminSiteSubscribers,
} from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users, Globe, Bell, ArrowLeft, BarChart2, AlertTriangle,
  CheckCircle, XCircle, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';

const PLANS = ['free', 'starter', 'pro', 'enterprise'];

interface SiteDetail {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  activeSubscribers: number;
  totalSubscribers: number;
  notifCount: number;
  createdAt: string;
}

interface ClientDetail {
  id: string;
  name: string;
  email: string;
  plan: string;
  planExpiresAt: string | null;
  isPlanExpired: boolean;
  isActive: boolean;
  sitesCount: number;
  subscriberCount: number;
  totalActiveSubscribers: number;
  totalNotifications: number;
  createdAt: string;
  lastLoginAt: string | null;
  sites: SiteDetail[];
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [editingPlan, setEditingPlan] = useState(false);

  // Site drill-down state
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [siteTab, setSiteTab] = useState<'notifications' | 'subscribers'>('notifications');
  const [siteData, setSiteData] = useState<any>(null);
  const [siteDataLoading, setSiteDataLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getAdminClientDetail(id);
      setClient(res.data);
      setNewPlan(res.data.plan);
    } catch {
      toast.error('Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSavePlan = async () => {
    setSaving(true);
    try {
      await updateUserPlan(id, newPlan, newExpiry || null);
      toast.success('Plan updated');
      setEditingPlan(false);
      load();
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSuspend = async () => {
    if (!client) return;
    try {
      if (client.isActive) {
        await suspendClient(id);
        toast.success('Client suspended');
      } else {
        await reactivateClient(id);
        toast.success('Client reactivated');
      }
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const loadSiteData = async (siteId: string, tab: 'notifications' | 'subscribers') => {
    setSiteDataLoading(true);
    setSiteData(null);
    try {
      const res = tab === 'notifications'
        ? await getAdminSiteNotifications(siteId)
        : await getAdminSiteSubscribers(siteId);
      setSiteData(res.data);
    } catch {
      toast.error('Failed to load site data');
    } finally {
      setSiteDataLoading(false);
    }
  };

  const toggleSite = (siteId: string) => {
    if (expandedSite === siteId) { setExpandedSite(null); setSiteData(null); return; }
    setExpandedSite(siteId);
    setSiteTab('notifications');
    loadSiteData(siteId, 'notifications');
  };

  const switchTab = (tab: 'notifications' | 'subscribers') => {
    setSiteTab(tab);
    if (expandedSite) loadSiteData(expandedSite, tab);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
      </div>
    );
  }

  if (!client) return <p className="text-muted-foreground">Client not found.</p>;

  return (
    <div>
      {/* Back button */}
      <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => router.push('/super-admin/clients')}>
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={client.isActive ? 'success' : 'destructive'} className="text-sm px-3 py-1">
            {client.isActive ? <CheckCircle className="h-3.5 w-3.5 mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
            {client.isActive ? 'Active' : 'Suspended'}
          </Badge>
          <Button
            variant={client.isActive ? 'destructive' : 'default'}
            size="sm"
            onClick={handleToggleSuspend}
          >
            {client.isActive ? 'Suspend' : 'Reactivate'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Sites</p>
            <p className="text-2xl font-bold">{client.sites.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Active Subscribers</p>
            <p className="text-2xl font-bold">{formatNumber(client.totalActiveSubscribers)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Bell className="h-3.5 w-3.5" /> Notifications</p>
            <p className="text-2xl font-bold">{formatNumber(client.totalNotifications)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Joined</p>
            <p className="text-sm font-medium">{formatDateTime(client.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Plan Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Subscription Plan</span>
              {!editingPlan && (
                <Button size="sm" variant="outline" onClick={() => { setEditingPlan(true); setNewExpiry(client.planExpiresAt ? client.planExpiresAt.slice(0, 10) : ''); }}>
                  Edit
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingPlan ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Plan</label>
                  <select
                    className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                  >
                    {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Expiry Date (optional)</label>
                  <Input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} className="text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePlan} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingPlan(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current plan</span>
                  <Badge variant="secondary" className="capitalize">{client.plan}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires</span>
                  {client.planExpiresAt ? (
                    <span className={client.isPlanExpired ? 'text-destructive font-medium' : 'text-foreground'}>
                      {client.isPlanExpired && <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />}
                      {formatDateTime(client.planExpiresAt)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Account Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{client.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={client.isActive ? 'success' : 'destructive'} className="text-xs">
                {client.isActive ? 'Active' : 'Suspended'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last login</span>
              <span>{client.lastLoginAt ? formatDateTime(client.lastLoginAt) : 'Never'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registered</span>
              <span>{formatDateTime(client.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sites */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-1.5">
            <Globe className="h-4 w-4" /> Sites ({client.sites.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {client.sites.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">No sites registered</p>
          ) : (
            <div className="divide-y">
              {client.sites.map((site) => (
                <div key={site.id}>
                  {/* Site row */}
                  <div
                    className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => toggleSite(site.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        <Badge variant={site.isActive ? 'success' : 'secondary'} className="text-xs">
                          {site.isActive ? 'Active' : 'Off'}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{site.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{site.domain}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <div className="text-center hidden sm:block">
                        <p className="text-xs text-muted-foreground">Subscribers</p>
                        <p className="text-sm font-medium">{formatNumber(site.activeSubscribers)}</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-xs text-muted-foreground">Notifications</p>
                        <p className="text-sm font-medium">{formatNumber(site.notifCount)}</p>
                      </div>
                      {expandedSite === site.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded site data */}
                  {expandedSite === site.id && (
                    <div className="border-t bg-muted/10 px-5 py-4">
                      {/* Tabs */}
                      <div className="flex gap-2 mb-4">
                        <Button
                          size="sm"
                          variant={siteTab === 'notifications' ? 'default' : 'outline'}
                          className="gap-1"
                          onClick={() => switchTab('notifications')}
                        >
                          <Bell className="h-3.5 w-3.5" /> Notifications
                        </Button>
                        <Button
                          size="sm"
                          variant={siteTab === 'subscribers' ? 'default' : 'outline'}
                          className="gap-1"
                          onClick={() => switchTab('subscribers')}
                        >
                          <Users className="h-3.5 w-3.5" /> Subscribers
                        </Button>
                      </div>

                      {siteDataLoading ? (
                        <div className="flex justify-center py-6">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                        </div>
                      ) : siteTab === 'notifications' ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 text-muted-foreground font-medium">Title</th>
                                <th className="text-left py-2 text-muted-foreground font-medium hidden sm:table-cell">Status</th>
                                <th className="text-left py-2 text-muted-foreground font-medium hidden md:table-cell">Sent</th>
                                <th className="text-left py-2 text-muted-foreground font-medium hidden md:table-cell">Delivered</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {siteData?.notifications?.length === 0 && (
                                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No notifications</td></tr>
                              )}
                              {siteData?.notifications?.map((n: any) => (
                                <tr key={n.id} className="border-b last:border-0">
                                  <td className="py-2 font-medium max-w-[200px] truncate">{n.title}</td>
                                  <td className="py-2 hidden sm:table-cell">
                                    <Badge variant={n.status === 'sent' ? 'success' : n.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                                      {n.status}
                                    </Badge>
                                  </td>
                                  <td className="py-2 hidden md:table-cell">{n.totalSent ?? 0}</td>
                                  <td className="py-2 hidden md:table-cell">{n.totalDelivered ?? 0}</td>
                                  <td className="py-2 text-muted-foreground">{formatDateTime(n.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 text-muted-foreground font-medium">Browser</th>
                                <th className="text-left py-2 text-muted-foreground font-medium hidden sm:table-cell">Device</th>
                                <th className="text-left py-2 text-muted-foreground font-medium hidden md:table-cell">Country</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Subscribed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {siteData?.subscribers?.length === 0 && (
                                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No subscribers</td></tr>
                              )}
                              {siteData?.subscribers?.map((s: any) => (
                                <tr key={s.id} className="border-b last:border-0">
                                  <td className="py-2 font-medium capitalize">{s.browser || '—'}</td>
                                  <td className="py-2 hidden sm:table-cell capitalize">{s.deviceType || '—'}</td>
                                  <td className="py-2 hidden md:table-cell">{s.country || '—'}</td>
                                  <td className="py-2">
                                    <Badge variant={s.isActive ? 'success' : 'secondary'} className="text-[10px]">
                                      {s.isActive ? 'Active' : 'Unsub'}
                                    </Badge>
                                  </td>
                                  <td className="py-2 text-muted-foreground">{formatDateTime(s.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
