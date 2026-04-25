'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect all traffic to the unified login page
export default function SuperAdminLoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, []);
  return null;
}
