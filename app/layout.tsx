import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Wonderland Playhouse — Brooklyn',
    template: '%s · Wonderland Playhouse',
  },
  description:
    "Brooklyn's 4,000 sq ft indoor playhouse. Birthday parties, open play, and a soft place to land for kids 0–7.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com'
  ),
  openGraph: {
    title: 'Wonderland Playhouse',
    description:
      "Brooklyn's 4,000 sq ft indoor playhouse. Birthday parties, open play, kids 0–7.",
    url: '/',
    siteName: 'Wonderland Playhouse',
    locale: 'en_US',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-ink">{children}</body>
    </html>
  );
}
