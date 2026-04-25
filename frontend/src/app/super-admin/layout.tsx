import SuperAdminClient from '@/components/SuperAdminClient';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminClient>{children}</SuperAdminClient>;
}
