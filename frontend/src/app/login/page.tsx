'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { useStore } from '@/lib/store';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Bell, Shield, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const { setToken, setUser, token, user } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('posh_token');
    if (saved) setToken(saved);
    setMounted(true);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!mounted || !token || !user) return;
    if (user.role === 'super_admin') {
      router.replace('/super-admin');
    } else {
      router.replace('/dashboard');
    }
  }, [mounted, token, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password);
      setToken(res.data.accessToken);
      setUser(res.data.user);
      if (res.data.user?.role === 'super_admin') {
        router.push('/super-admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Posh Push</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        {/* Role indicators */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Client Login</span>
          </div>
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
            <Shield className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Super Admin Login</span>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5"
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Super admins are automatically redirected to the admin panel.
              </p>
              <p className="text-center text-sm text-muted-foreground border-t pt-3">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary hover:underline font-medium">Sign up</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
