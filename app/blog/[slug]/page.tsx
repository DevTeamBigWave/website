import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BlogContent } from '@/components/BlogContent';
import { getPostBySlug, getPublishedPosts } from '@/lib/blog';
import { SITE_URL as SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post not found' };
  const url = `${SITE}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url,
      publishedTime: post.published_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  // Related posts: 3 most recent excluding this one
  const all = await getPublishedPosts(20);
  const related = all.filter((p) => p.id !== post.id).slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Organization',
      name: 'Wonderland Playhouse',
      url: SITE,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Wonderland Playhouse',
      url: SITE,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/blog/${post.slug}` },
    keywords: post.keywords?.join(', '),
  };

  return (
    <>
      <AnnouncementBar />
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="bg-cream pb-16">
        <header className="bg-gradient-to-b from-cream to-sky-50">
          <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
            <p className="text-xs font-bold uppercase tracking-wider text-coral">
              <Link href="/blog" className="hover:text-coral-700">← Wonderland Blog</Link>
            </p>
            <div className="mt-6 text-5xl">{post.hero_emoji}</div>
            <h1 className="mt-3 font-display text-4xl text-slate-700 sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-4 text-base text-slate-500">{post.excerpt}</p>
            <p className="mt-6 text-xs uppercase tracking-wider text-slate-400">
              {fmtDate(post.published_at)}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 py-10">
          <BlogContent blocks={post.content} />
        </div>

        {related.length > 0 && (
          <div className="mx-auto mt-10 max-w-5xl px-6">
            <h2 className="font-display text-2xl text-slate-700">More from the blog</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"
                >
                  <div className="text-2xl">{p.hero_emoji}</div>
                  <h3 className="mt-2 font-display text-lg text-slate-700 group-hover:text-coral">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-xs text-slate-500">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
      <Footer />
    </>
  );
}
