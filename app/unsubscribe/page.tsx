import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UnsubscribeForm } from './UnsubscribeForm';
import { verifyEmailToken } from '@/lib/marketing';

export const metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; scope?: string; token?: string }>;
}) {
  const { email = '', scope = 'all', token = '' } = await searchParams;
  const validScope =
    scope === 'all' || scope === 'birthday_reminders' || scope === 'promotions' || scope === 'special_events'
      ? scope
      : 'all';
  const valid = email && token ? verifyEmailToken(email, token) : false;

  return (
    <>
      <AnnouncementBar />
      <Header />
      <div className="mx-auto max-w-xl px-6 py-16 md:py-20">
        {valid ? (
          <UnsubscribeForm email={email} initialScope={validScope} token={token} />
        ) : (
          <div className="rounded-3xl bg-white p-8 shadow-card">
            <h1 className="font-display text-3xl text-slate-700">Unsubscribe link invalid</h1>
            <p className="mt-3 text-slate-500">
              This link may have expired or been mistyped. Please use the link from
              your most recent email, or reply directly and we&rsquo;ll remove you.
            </p>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
