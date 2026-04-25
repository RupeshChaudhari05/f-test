'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getSubscribers } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Users, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Subscriber {
  id: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: string;
  country: string;
  city: string;
  language: string;
  timezone: string;
  tags: string[];
  isActive: boolean;
  consentStatus: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export default function SubscribersPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    if (!currentSite) return;
    setLoading(true);
    getSubscribers(currentSite.id, { page, limit, search: search || undefined })
      .then((res) => {
        const data = res.data;
        setSubscribers(data.subscribers || data || []);
        setTotal(data.total ?? (data.subscribers ?? data ?? []).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentSite, page, search]);

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>No Site Selected</CardTitle>
            <CardDescription>Select or create a site to view subscribers.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscribers</h1>
          <p className="text-muted-foreground mt-1">
            {total > 0 ? `${total} total subscriber${total !== 1 ? 's' : ''}` : 'Manage your push notification subscribers'}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by browser, OS, country..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 w-72"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Browser / OS</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Device</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Language</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tags</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                    Loading...
                  </td></tr>
                ) : subscribers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No subscribers yet</p>
                    <p className="text-xs mt-1">Visitors who allow notifications on your WordPress site will appear here.</p>
                  </td></tr>
                ) : (
                  subscribers.map((sub) => (
                    <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium">{sub.browser || '—'} {sub.browserVersion || ''}</div>
                        <div className="text-xs text-muted-foreground">{sub.os || ''} {sub.osVersion || ''}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">{sub.deviceType || '—'}</td>
                      <td className="px-4 py-3">{[sub.city, sub.country].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{sub.language || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(sub.tags || []).length > 0
                            ? sub.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))
                            : <span className="text-muted-foreground text-xs">—</span>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sub.isActive ? 'success' : 'secondary'}>
                          {sub.isActive ? 'Active' : 'Unsubscribed'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(sub.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
