'use client';

import { useEffect, useState } from 'react';
import { getAdminSites } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Globe } from 'lucide-react';

const siteCols = [
  {
    key: 'name', header: 'Site Name',
    render: (s: any) => (
      <span className="font-medium flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{s.name}
      </span>
    ),
    accessorFn: (s: any) => s.name,
  },
  { key: 'domain', header: 'Domain', render: (s: any) => <span className="text-xs text-muted-foreground">{s.domain}</span>, accessorFn: (s: any) => s.domain },
  {
    key: 'owner', header: 'Owner',
    render: (s: any) => (
      <div>
        <p className="text-xs font-medium">{s.user?.name}</p>
        <p className="text-[10px] text-muted-foreground">{s.user?.email}</p>
      </div>
    ),
    accessorFn: (s: any) => `${s.user?.name ?? ''} ${s.user?.email ?? ''}`,
  },
  {
    key: 'plan', header: 'Owner Plan',
    render: (s: any) => <Badge variant="secondary" className="capitalize text-xs">{s.user?.plan}</Badge>,
    accessorFn: (s: any) => s.user?.plan ?? '',
  },
  {
    key: 'isActive', header: 'Status',
    render: (s: any) => (
      <Badge variant={s.isActive !== false ? 'success' : 'destructive'} className="text-xs">
        {s.isActive !== false ? 'Active' : 'Off'}
      </Badge>
    ),
    accessorFn: (s: any) => s.isActive !== false ? 'active' : 'off',
  },
  { key: 'createdAt', header: 'Created', render: (s: any) => <span className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span>, accessorFn: (s: any) => s.createdAt },
];

export default function AdminSitesPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminSites()
      .then((res) => {
        const data = res.data.sites || res.data;
        setSites(data);
        setTotal(res.data.total || data.length);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Sites</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} total sites across all clients</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sites</CardTitle>
          <CardDescription>Search by name, domain or owner. Click any column to sort.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <DataTable
              columns={siteCols as any}
              data={sites}
              rowKey={(s: any) => s.id}
              searchable
              searchPlaceholder="Search by site name, domain, or owner..."
              emptyMessage="No sites found"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
