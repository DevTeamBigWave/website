import Link from 'next/link';
import { getAllPostsForAdmin } from '@/lib/blog';
import { GenerateBlogButton } from './GenerateBlogButton';

export const dynamic = 'force-dynamic';

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

export default async function AdminBlogPage() {
  const posts = await getAllPostsForAdmin(200);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-700">Blog</h1>
          <p className="mt-1 text-sm text-slate-500">
            {posts.length} post{posts.length === 1 ? '' : 's'} · auto-generated
            every Monday for SEO
          </p>
        </div>
        <div className="flex gap-2">
          <GenerateBlogButton defaultCount={3} label="Generate 3 now" />
          <GenerateBlogButton defaultCount={9} label="Kickoff: generate 9" variant="accent" />
        </div>
      </header>

      <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
        <strong>How this works:</strong> posts generate in parallel (~20-30s
        total regardless of count). Set up a weekly Monday hit on cron-job.org
        targeting{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs">
          /api/cron/weekly-blog
        </code>{' '}
        with header{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs">x-cron-secret: $CRON_SECRET</code>.
        Topics rotate from <code className="rounded bg-white px-1 py-0.5 text-xs">lib/blog.ts</code> and
        avoid duplicates from the last 60 days.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Primary keyword</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    className="font-semibold text-slate-700 hover:text-coral"
                  >
                    {p.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-400">/{p.slug}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.primary_keyword ?? '—'}</td>
                <td className="px-4 py-3 capitalize">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.status === 'published'
                        ? 'bg-sky-100 text-sky-700'
                        : p.status === 'draft'
                          ? 'bg-sunshine-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {p.generated_by === 'ai' ? `AI · ${p.model ?? ''}` : 'Manual'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(p.published_at)}</td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  No posts yet. Tap &ldquo;Kickoff: generate 6&rdquo; above to seed the blog.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
