import type { ReactNode } from 'react';
import DeployRail from '@/components/DeployRail';

export default function DashLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DeployRail />
      <main className="wrap">{children}</main>
    </>
  );
}
