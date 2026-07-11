import './globals.css';

export const metadata = {
  title: 'Blog admin',
  description: 'Blue-green publishing cockpit for tailwind-nextjs-starter-blog',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
