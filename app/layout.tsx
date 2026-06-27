import type { Metadata } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';
import { ChatWidget } from '@/components/ChatWidget';
import { Analytics } from '@/components/Analytics';
import { SITE_URL, GOOGLE_MAPS_URL } from '@/lib/site';
import { OPEN_PLAY_OPEN_HHMM, OPEN_PLAY_CLOSE_HHMM } from '@/lib/hours';

// Verified social / listing profiles for JSON-LD sameAs. Instagram is known;
// the Google Maps listing is added when its env var is set (the GBP API
// captures the canonical URL — see lib/site.ts).
const SAME_AS = [
  'https://www.instagram.com/wonderlandplayhouseny',
  ...(GOOGLE_MAPS_URL ? [GOOGLE_MAPS_URL] : []),
];

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
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Wonderland Playhouse',
    description:
      "Brooklyn's magical, low-stim birthday venue. Private parties + open play for kids 0–8.",
    url: '/',
    siteName: 'Wonderland Playhouse',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wonderland Playhouse — Brooklyn',
    description:
      "Brooklyn's magical, low-stim birthday venue. Private parties + open play for kids 0–8.",
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.jpg',
  },
  other: {
    'instagram:profile': 'https://www.instagram.com/wonderlandplayhouseny',
  },
};

// Structured data for Google + AI answer engines. One @graph with three linked
// nodes: Organization (the brand), WebSite (the domain), and LocalBusiness (the
// physical venue). All facts are real and sourced from the site/config; hours
// come from lib/hours.ts so they can't drift. sameAs lists only verified
// socials — add more in metadata/JSON-LD as accounts are confirmed.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Wonderland Playhouse',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.jpg`,
      email: 'info@wonderlandplayhouse.com',
      telephone: '+1-718-889-1777',
      sameAs: SAME_AS,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Wonderland Playhouse',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': ['LocalBusiness', 'ChildCare', 'EntertainmentBusiness'],
      '@id': `${SITE_URL}/#localbusiness`,
      name: 'Wonderland Playhouse',
      description:
        'A magical, low-stim birthday venue and indoor play space in Brooklyn, NY for kids ages 0–8. Private and semi-private birthday parties, open play, and memberships.',
      image: `${SITE_URL}/logo.jpg`,
      url: SITE_URL,
      telephone: '+1-718-889-1777',
      email: 'info@wonderlandplayhouse.com',
      parentOrganization: { '@id': `${SITE_URL}/#organization` },
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
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
          opens: OPEN_PLAY_OPEN_HHMM,
          closes: OPEN_PLAY_CLOSE_HHMM,
        },
      ],
      sameAs: SAME_AS,
      ...(GOOGLE_MAPS_URL ? { hasMap: GOOGLE_MAPS_URL } : {}),
      priceRange: '$$',
      areaServed: 'Brooklyn, NY',
    },
  ],
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {children}
        <ChatWidget />
        <Analytics />
      </body>
    </html>
  );
}
