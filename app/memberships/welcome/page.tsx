import Link from 'next/link';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Welcome to the Wonderland Pass',
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
            You&rsquo;re a member ✓
          </p>
          <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
            Welcome to the Wonderland Pass.
          </h1>
          <p className="mt-3 text-slate-500">
            Confirmation email is on its way with the details. Walk in any open day —
            just give us your name at the front desk and we&rsquo;ll look you up.
          </p>
          <div className="mt-6 rounded-2xl bg-cream-deep p-5 text-sm text-slate-700">
            <p className="font-bold">Reminder</p>
            <p className="mt-1">
              We close to open play during private parties. The{' '}
              <Link href="/book/open-play" className="text-coral font-semibold">
                booking page
              </Link>{' '}
              shows partial-closure windows so you can plan around them.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book/open-play"
              className="rounded-full bg-coral px-6 py-3 text-sm font-bold text-white shadow-playful hover:bg-coral-600"
            >
              Plan a visit →
            </Link>
            <Link
              href="/memberships/manage"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-slate-400"
            >
              Manage membership
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
