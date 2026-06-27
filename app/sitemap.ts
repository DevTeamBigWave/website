import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '@/lib/blog';
import { SITE_URL as SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';

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

  // Blog posts are dynamic; if the fetch ever fails, still return the static
  // routes rather than 500-ing the whole sitemap.
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPublishedPosts(500);
    blogRoutes = posts.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error('[sitemap] blog fetch failed, serving static routes only:', err);
  }

  return [...staticRoutes, ...blogRoutes];
}
