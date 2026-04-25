'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { getProfile } from '@/lib/api';
import {
  Shield, Users, Globe, BarChart3, LogOut, Bell, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const NAV = [
  { href: '/super-admin', label: 'Overview', icon: BarChart3, exact: true },
  { href: '/super-admin/clients', label: 'Clients', icon: Users },
  { href: '/super-admin/sites', label: 'All Sites', icon: Globe },
];

export default function SuperAdminClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, setToken, setUser, logout } = useStore();
  const [mounted, setMounted] = useState(false);

  // The login page renders its own UI — bypass layout auth wrapping
  const isLoginPage = pathname === '/super-admin/login';

  useEffect(() => {
    const saved = localStorage.getItem('posh_token');
    if (saved) setToken(saved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoginPage) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (!user) {
      getProfile()
        .then((res) => {
          if (res.data.role !== 'super_admin') {
            router.replace('/dashboard');
            return;
          }
          setUser(res.data);
        })
        .catch(() => {
          logout();
          router.replace('/login');
        });
    } else if (user.role !== 'super_admin') {
      router.replace('/dashboard');
    }
  }, [mounted, token, user, isLoginPage]);

  // For login page — render children directly (no sidebar)
  if (isLoginPage) return <>{children}</>;

  // Show loading while checking auth (don't update state during render)
  if (!mounted || !token || !user || user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-destructive" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b bg-destructive/5">
          <Link href="/super-admin" className="flex items-center gap-2">
            <div className="p-1.5 bg-destructive/10 rounded-lg">
              <Shield className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground">Posh Push</span>
              <p className="text-[10px] text-destructive font-medium leading-none mt-0.5">SUPER ADMIN</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-destructive/10 text-destructive'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Client dashboard link */}
        <div className="p-3 border-t border-b">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition"
          >
            <Bell className="h-4 w-4" />
            Back to Client Dashboard
          </Link>
        </div>

        {/* User */}
        <div className="p-3">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="destructive" className="text-[10px] px-1 py-0">SA</Badge>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
