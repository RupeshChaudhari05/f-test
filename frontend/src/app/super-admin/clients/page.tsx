'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  getAdminClients, getAdminClientDetail,
  updateUserPlan, setPlanExpiry,
  suspendClient, reactivateClient,
} from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users, Search, ChevronDown, ChevronUp, Globe,
  Calendar, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';

const PLANS = ['free', 'starter', 'pro', 'enterprise'];

const planVariant: Record<string, string> = {
  free: 'secondary',
  starter: 'default',
  pro: 'warning',
  enterprise: 'success',
};

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ expiresAt, isPlanExpired }: { expiresAt: string | null; isPlanExpired: boolean }) {
  if (!expiresAt) return <span className="text-xs text-muted-foreground">No expiry</span>;
  const days = daysUntilExpiry(expiresAt);
  if (isPlanExpired) return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Expired</Badge>;
  if (days !== null && days <= 7) return <Badge variant="warning" className="text-xs">{days}d left</Badge>;
  return <span className="text-xs text-muted-foreground">{formatDateTime(expiresAt)}</span>;
}

interface Client {
  id: string;
  name: string;
  email: string;
  plan: string;
  planExpiresAt: string | null;
  isPlanExpired: boolean;
  isActive: boolean;
  sitesCount: number;
  subscriberCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}

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

interface ClientDetail extends Client {
  sites: SiteDetail[];
  totalActiveSubscribers: number;
  totalNotifications: number;
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Expanded client detail state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ClientDetail | null>(null);

  // Plan edit state
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editingExpiry, setEditingExpiry] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback((pg = 1, q = '') => {
    setLoading(true);
    getAdminClients({ page: pg, limit: 20, search: q || undefined })
      .then((res) => {
        setClients(res.data.clients);
        setTotal(res.data.total);
      })
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadClients(1, search); }, []);

  const handleSearch = () => { setPage(1); loadClients(1, search); };

  const toggleExpand = async (clientId: string) => {
    if (expandedId === clientId) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(clientId);
    setDetailLoading(true);
    try {
      const res = await getAdminClientDetail(clientId);
      setDetail(res.data);
    } catch {
      toast.error('Failed to load client detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSavePlan = async (clientId: string) => {
    setSaving(true);
    try {
      await updateUserPlan(clientId, newPlan, newExpiry || null);
      toast.success('Plan updated');
      setEditingPlan(null);
      loadClients(page, search);
      if (expandedId === clientId) {
        const res = await getAdminClientDetail(clientId);
        setDetail(res.data);
      }
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpiry = async (clientId: string) => {
    setSaving(true);
    try {
      await setPlanExpiry(clientId, newExpiry || null);
      toast.success('Plan expiry updated');
      setEditingExpiry(null);
      loadClients(page, search);
    } catch {
      toast.error('Failed to update expiry');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (clientId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await suspendClient(clientId);
        toast.success('Client suspended — all sites deactivated');
      } else {
        await reactivateClient(clientId);
        toast.success('Client reactivated');
      }
      loadClients(page, search);
      if (expandedId === clientId) {
        const res = await getAdminClientDetail(clientId);
        setDetail(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total clients registered</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} variant="outline">Search</Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No clients found</p>
            </div>
          ) : (
            <div className="divide-y">
              {clients.map((client) => {
                const isExpanded = expandedId === client.id;
                const isEditPlan = editingPlan === client.id;
                const isEditExpiry = editingExpiry === client.id;
                const days = daysUntilExpiry(client.planExpiresAt);
                const expiringSoon = days !== null && days <= 7 && !client.isPlanExpired;

                return (
                  <div key={client.id}>
                    {/* Client Row */}
                    <div
                      className={`px-4 py-4 hover:bg-muted/20 transition ${
                        !client.isActive ? 'opacity-60 bg-destructive/5' : ''
                      } ${expiringSoon ? 'bg-amber-50/40' : ''} ${client.isPlanExpired ? 'bg-destructive/5' : ''}`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Name + Email */}
                        <div className="flex-1 min-w-[180px]">
                          <p className="font-medium text-foreground text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                        </div>

                        {/* Plan */}
                        <div className="w-36">
                          {isEditPlan ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={newPlan}
                                onChange={(e) => setNewPlan(e.target.value)}
                                className="text-xs border border-input rounded px-2 py-1 bg-background"
                                autoFocus
                              >
                                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <Button size="sm" className="h-6 text-xs px-2" disabled={saving}
                                onClick={() => handleSavePlan(client.id)}>Save</Button>
                              <button onClick={() => setEditingPlan(null)} className="text-xs text-muted-foreground">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingPlan(client.id); setNewPlan(client.plan); setNewExpiry(client.planExpiresAt?.slice(0, 10) || ''); }}
                              className="flex items-center gap-1"
                            >
                              <Badge variant={(planVariant[client.plan] as any) ?? 'secondary'} className="capitalize text-xs cursor-pointer">
                                {client.plan}
                              </Badge>
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>

                        {/* Expiry */}
                        <div className="w-40">
                          {isEditExpiry ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="date"
                                value={newExpiry}
                                onChange={(e) => setNewExpiry(e.target.value)}
                                className="h-7 text-xs w-32"
                              />
                              <Button size="sm" className="h-6 text-xs px-2" disabled={saving}
                                onClick={() => handleSaveExpiry(client.id)}>Save</Button>
                              <button onClick={() => setEditingExpiry(null)} className="text-xs text-muted-foreground">✕</button>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-1 text-left"
                              onClick={() => { setEditingExpiry(client.id); setNewExpiry(client.planExpiresAt?.slice(0, 10) || ''); }}
                              title="Click to set expiry date"
                            >
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <ExpiryBadge expiresAt={client.planExpiresAt} isPlanExpired={client.isPlanExpired} />
                            </button>
                          )}
                        </div>

                        {/* Sites / Subscribers */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5" /> {client.sitesCount} sites
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {formatNumber(client.subscriberCount)}
                          </span>
                        </div>

                        {/* Status */}
                        <Badge variant={client.isActive ? 'success' : 'destructive'} className="text-xs">
                          {client.isActive ? 'Active' : 'Suspended'}
                        </Badge>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          <Link href={`/super-admin/clients/${client.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                              View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant={client.isActive ? 'destructive' : 'outline'}
                            className="h-7 text-xs px-2.5"
                            onClick={() => handleSuspend(client.id, client.isActive)}
                          >
                            {client.isActive ? (
                              <><XCircle className="h-3 w-3 mr-1" />Suspend</>
                            ) : (
                              <><CheckCircle className="h-3 w-3 mr-1" />Activate</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2"
                            onClick={() => toggleExpand(client.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Expiry warning banner */}
                      {client.isPlanExpired && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Plan expired — client cannot receive notifications until renewed
                        </div>
                      )}
                      {expiringSoon && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Plan expiring in {days} day{days !== 1 ? 's' : ''} — renew soon
                        </div>
                      )}
                    </div>

                    {/* Expanded Sites Detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-muted/20 border-t">
                        {detailLoading || !detail ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                            Loading client details...
                          </div>
                        ) : (
                          <div className="pt-4">
                            {/* Summary */}
                            <div className="flex items-center gap-6 mb-4 text-sm">
                              <span className="text-muted-foreground">
                                Total active subscribers: <strong className="text-foreground">{formatNumber(detail.totalActiveSubscribers)}</strong>
                              </span>
                              <span className="text-muted-foreground">
                                Total notifications: <strong className="text-foreground">{formatNumber(detail.totalNotifications)}</strong>
                              </span>
                              <span className="text-muted-foreground">
                                Last login: <strong className="text-foreground">{detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : 'Never'}</strong>
                              </span>
                            </div>

                            {/* Sites Table */}
                            {detail.sites.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">No sites registered</p>
                            ) : (
                              <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b bg-muted/40">
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Site Name</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Domain</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Subscribers</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notifications</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Created</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.sites.map((site) => (
                                      <tr key={site.id} className="border-b last:border-0 hover:bg-muted/20">
                                        <td className="px-4 py-2.5 font-medium text-foreground">{site.name}</td>
                                        <td className="px-4 py-2.5 text-muted-foreground">{site.domain}</td>
                                        <td className="px-4 py-2.5">
                                          <span className="text-foreground font-medium">{formatNumber(site.activeSubscribers)}</span>
                                          <span className="text-muted-foreground"> / {formatNumber(site.totalSubscribers)}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-foreground">{formatNumber(site.notifCount)}</td>
                                        <td className="px-4 py-2.5">
                                          <Badge variant={site.isActive ? 'success' : 'destructive'} className="text-[10px]">
                                            {site.isActive ? 'Active' : 'Off'}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(site.createdAt)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); loadClients(p, search); }}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages}
              onClick={() => { const p = page + 1; setPage(p); loadClients(p, search); }}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
