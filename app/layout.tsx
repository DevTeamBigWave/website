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
  other: {
    'instagram:profile': 'https://www.instagram.com/wonderlandplayhouseny',
  },
};

const LOCAL_BUSINESS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Wonderland Playhouse',
  image: 'https://www.wonderlandplayhouse.com/logo.jpg',
  url: 'https://www.wonderlandplayhouse.com',
  telephone: '+1-718-889-1777',
  email: 'info@wonderlandplayhouse.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '3830 Nostrand Ave',
    addressLocality: 'Brooklyn',
    addressRegion: 'NY',
    postalCode: '11235',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 40.5891,
    longitude: -73.9389,
  },
  sameAs: ['https://www.instagram.com/wonderlandplayhouseny'],
  priceRange: '$$',
  areaServed: 'Brooklyn, NY',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-cream text-slate-700">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSON_LD) }}
        />
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
