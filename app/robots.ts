import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep private / transactional / auth routes out of the index.
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/book/confirm',
          '/gift-cards/sent',
          '/memberships/manage',
          '/memberships/welcome',
          '/unsubscribe',
          '/waiver',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
