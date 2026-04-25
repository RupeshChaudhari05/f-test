'use client';

import { useEffect, useState } from 'react';
import { getAdminSites } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';

export default function AdminSitesPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminSites()
      .then((res) => { setSites(res.data.sites || res.data); setTotal(res.data.total || (res.data.sites || res.data).length); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">All Sites</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} total sites across all clients</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Site Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Domain</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Owner Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        {site.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{site.domain}</td>
                      <td className="px-4 py-3">
                        <p className="text-foreground text-xs font-medium">{site.user?.name}</p>
                        <p className="text-muted-foreground text-[10px]">{site.user?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize text-xs">{site.user?.plan}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={site.isActive !== false ? 'success' : 'destructive'} className="text-xs">
                          {site.isActive !== false ? 'Active' : 'Off'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(site.createdAt)}</td>
                    </tr>
                  ))}
                  {sites.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No sites found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
