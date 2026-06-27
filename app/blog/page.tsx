import Link from 'next/link';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getPublishedPosts } from '@/lib/blog';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Blog — Brooklyn kid birthdays, party planning, play space tips',
  description:
    'Honest, parent-to-parent guides to throwing birthdays in Brooklyn, picking a play space, and what works for kids 0–8.',
  alternates: { canonical: '/blog' },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export default async function BlogIndex() {
  const posts = await getPublishedPosts(60);

  return (
    <>
      <AnnouncementBar />
      <Header />
      <section className="bg-gradient-to-b from-cream to-sky-50">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
          <p className="text-xs font-bold uppercase tracking-wider text-coral">The Wonderland Blog</p>
          <h1 className="mt-2 font-display text-5xl text-slate-700 sm:text-6xl">
            Real talk for Brooklyn parents.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-500">
            Birthday party planning, indoor play space picks, age-by-age tips,
            and honest opinions from a small family-owned venue in South Brooklyn.
          </p>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-5xl px-6">
          {posts.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
              <p className="text-slate-500">
                Posts are on the way. First batch publishes Monday.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-playful"
                >
                  <div className="text-3xl">{p.hero_emoji}</div>
                  <h2 className="mt-3 font-display text-2xl text-slate-700 group-hover:text-coral">
                    {p.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm text-slate-600">{p.excerpt}</p>
                  <p className="mt-5 text-xs uppercase tracking-wider text-slate-400">
                    {fmtDate(p.published_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </>
  );
}
