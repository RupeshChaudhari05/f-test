'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { getSites, getProfile } from '@/lib/api';
import {
  Bell, BarChart3, Users, Send, Layers, Zap, Settings, LogOut,
  ChevronDown, Globe, Shield, FlaskConical, Plus,
  ArrowRightLeft, Code2, Crown, Layout,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const getNavItems = (userRole: string) => {
  const items = [
    { href: '/dashboard',                            label: 'Overview',        icon: BarChart3 },
    { href: '/dashboard/subscribers',                label: 'Subscribers',     icon: Users },
    { href: '/dashboard/notifications',              label: 'Notifications',   icon: Send },
    { href: '/dashboard/notifications/templates',    label: '↳ Templates',     icon: Layout },
    { href: '/dashboard/segments',                   label: 'Segments',        icon: Layers },
    { href: '/dashboard/automations',                label: 'Automations',     icon: Zap },
    { href: '/dashboard/ab-tests',                   label: 'A/B Tests',       icon: FlaskConical },
    { href: '/dashboard/analytics',                  label: 'Analytics',       icon: BarChart3 },
    { href: '/dashboard/migration',                  label: 'Migration',       icon: ArrowRightLeft },
    { href: '/dashboard/api-playground',             label: 'API Playground',  icon: Code2 },
    { href: '/dashboard/pricing',                    label: 'Pricing',         icon: Crown },
    { href: '/dashboard/settings',                   label: 'Site Settings',   icon: Settings },
  ];
  if (userRole === 'super_admin') {
    items.push({ href: '/dashboard/admin', label: 'Admin Panel', icon: Shield });
  }
  return items;
};

export default function DashboardClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, sites, currentSite, setSites, setCurrentSite, setToken, setUser, logout } = useStore();
  const [mounted, setMounted] = useState(false);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);

  const navItems = getNavItems(user?.role || 'user');

  // Step 1: Rehydrate token from localStorage after client mount
  useEffect(() => {
    const savedToken = localStorage.getItem('posh_token');
    if (savedToken) setToken(savedToken);
    setMounted(true);
  }, []);

  // Step 2: Once mounted and token known, load user + sites
  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    getProfile().then((res) => setUser(res.data)).catch(() => {});
    getSites().then((res) => {
      setSites(res.data);
      if (res.data.length > 0 && !currentSite) setCurrentSite(res.data[0]);
    }).catch(() => {
      logout();
      router.replace('/login');
    });
  }, [mounted, token]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  // Show loading until client hydration is complete (avoids SSR mismatch)
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground">Posh Push</span>
          </Link>
        </div>

        {/* Site Selector */}
        <div className="p-3 border-b relative">
          <button
            onClick={() => setSiteMenuOpen(!siteMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition"
          >
            <div className="flex items-center gap-2 truncate">
              <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate text-foreground">{currentSite?.name || 'Select site'}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${siteMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {siteMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-card border rounded-lg shadow-lg z-50 overflow-hidden">
              {sites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => { setCurrentSite(site); setSiteMenuOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition ${
                    currentSite?.id === site.id ? 'bg-muted font-medium' : ''
                  }`}
                >
                  {site.name}
                </button>
              ))}
              <Separator />
              <Link
                href="/dashboard/sites/new"
                onClick={() => setSiteMenuOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-muted transition"
              >
                <Plus className="h-3 w-3" /> Add Site
              </Link>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const isAdmin = item.href === '/dashboard/admin';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? isAdmin ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="truncate">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                {user?.role === 'super_admin' && <Badge variant="destructive" className="text-[10px] px-1 py-0">SA</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
