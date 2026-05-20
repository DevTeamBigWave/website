import type { Metadata } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';

const display = Fredoka({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const sans = Nunito({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Wonderland Playhouse — Brooklyn',
    template: '%s · Wonderland Playhouse',
  },
  description:
    "Brooklyn's private 4,000 sq ft indoor playhouse for kids 0–8. Birthday parties, open play, and a soft place to land.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com'
  ),
  openGraph: {
    title: 'Wonderland Playhouse',
    description:
      "Brooklyn's private 4,000 sq ft indoor playhouse. Birthday parties + open play for kids 0–8.",
    url: '/',
    siteName: 'Wonderland Playhouse',
    locale: 'en_US',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-cream text-slate-700">{children}</body>
    </html>
  );
}
