import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Blog admin', template: '%s · Blog admin' },
  description: 'Blue-green publishing cockpit for tailwind-nextjs-starter-blog',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
