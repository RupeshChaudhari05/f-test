'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSite } from '@/lib/api';
import { useStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewSitePage() {
  const router = useRouter();
  const { setCurrentSite, setSites, sites } = useStore();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createSite({ name, domain });
      setSites([...sites, res.data]);
      setCurrentSite(res.data);
      toast.success('Site created!');
      router.push('/dashboard/settings');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Add New Site</h1>
        <p className="text-muted-foreground mt-1">Register a new website for push notifications</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Site Details
          </CardTitle>
          <CardDescription>Enter your website information to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="siteName">Site Name</Label>
              <Input id="siteName" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="My Website" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" required value={domain} onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com" className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1">Enter without https:// prefix</p>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Site'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
