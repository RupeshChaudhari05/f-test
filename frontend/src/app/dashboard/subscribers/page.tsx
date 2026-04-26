'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getSubscribers } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';

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
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Subscribers</CardTitle>
          <CardDescription>Click any column to sort. Search by browser, OS, country, or tags.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'browser', header: 'Browser / OS',
                render: (sub: Subscriber) => (
                  <div>
                    <div className="font-medium">{sub.browser || '—'} {sub.browserVersion || ''}</div>
                    <div className="text-xs text-muted-foreground">{sub.os || ''} {sub.osVersion || ''}</div>
                  </div>
                ),
                accessorFn: (sub: Subscriber) => `${sub.browser} ${sub.os}`,
              },
              { key: 'deviceType', header: 'Device', render: (sub: Subscriber) => <span className="capitalize">{sub.deviceType || '—'}</span>, accessorFn: (sub: Subscriber) => sub.deviceType },
              { key: 'country', header: 'Location', render: (sub: Subscriber) => [sub.city, sub.country].filter(Boolean).join(', ') || '—', accessorFn: (sub: Subscriber) => `${sub.city ?? ''} ${sub.country ?? ''}` },
              { key: 'language', header: 'Language', render: (sub: Subscriber) => <span className="text-xs text-muted-foreground">{sub.language || '—'}</span>, accessorFn: (sub: Subscriber) => sub.language },
              {
                key: 'tags', header: 'Tags',
                render: (sub: Subscriber) => (
                  <div className="flex flex-wrap gap-1">
                    {(sub.tags || []).length > 0
                      ? sub.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </div>
                ),
                accessorFn: (sub: Subscriber) => (sub.tags || []).join(' '),
              },
              {
                key: 'isActive', header: 'Status',
                render: (sub: Subscriber) => <Badge variant={sub.isActive ? 'success' : 'secondary'}>{sub.isActive ? 'Active' : 'Unsubscribed'}</Badge>,
                accessorFn: (sub: Subscriber) => sub.isActive ? 'active' : 'unsubscribed',
              },
              { key: 'createdAt', header: 'Subscribed', render: (sub: Subscriber) => <span className="text-xs text-muted-foreground">{formatDateTime(sub.createdAt)}</span>, accessorFn: (sub: Subscriber) => sub.createdAt },
            ] as any}
            data={loading ? [] : subscribers}
            rowKey={(sub: any) => sub.id}
            searchable
            searchPlaceholder="Search by browser, OS, country, tags..."
            emptyMessage={loading ? 'Loading...' : 'No subscribers yet. Visitors who allow notifications will appear here.'}
          />
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
