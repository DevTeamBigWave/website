import type { Metadata } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';
import { ChatWidget } from '@/components/ChatWidget';

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
    "Brooklyn's magical, low-stim birthday venue and indoor play space for kids 0–8. Private parties, open play, memberships.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.wonderlandplayhouse.com'
  ),
  openGraph: {
    title: 'Wonderland Playhouse',
    description:
      "Brooklyn's magical, low-stim birthday venue. Private parties + open play for kids 0–8.",
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
      <body className="min-h-screen bg-cream text-slate-700">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
