import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '@/lib/blog';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wonderlandplayhouse.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    '',
    '/parties',
    '/memberships',
    '/gift-cards',
    '/about',
    '/tour',
    '/inquire',
    '/book',
    '/book/open-play',
    '/blog',
  ].map((path) => ({
    url: `${SITE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' || path === '/blog' ? 'weekly' : 'monthly',
    priority: path === '' ? 1.0 : path === '/parties' ? 0.9 : 0.7,
  })) as MetadataRoute.Sitemap;

  const posts = await getPublishedPosts(500);
  const blogRoutes = posts.map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...blogRoutes];
}
