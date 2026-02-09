import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Panel Haus',
  description: 'Independent Publishing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
