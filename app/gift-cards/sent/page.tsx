import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Gift card sent',
};

export default async function GiftCardSentPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();

  const db = supabaseAdmin();
  const { data: card } = await db
    .from('gift_cards')
    .select('amount_cents, recipient_name, recipient_email, status')
    .eq('id', id)
    .maybeSingle();

  if (!card) notFound();

  const paid = card.status === 'active' || card.status === 'redeemed';

  return (
    <>
      <AnnouncementBar />
      <Header />
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
            {paid ? 'Gift sent ✓' : 'Processing…'}
          </p>
          <h1 className="mt-2 font-display text-3xl text-slate-700 sm:text-4xl">
            {paid
              ? `Your $${(card.amount_cents / 100).toFixed(0)} gift card is on its way.`
              : 'Almost there — finalizing your gift card.'}
          </h1>
          {paid ? (
            <p className="mt-4 text-slate-500">
              We just emailed <strong>{card.recipient_name}</strong> at{' '}
              <strong>{card.recipient_email}</strong> with their code and how
              to redeem it. We also sent you a receipt.
            </p>
          ) : (
            <p className="mt-4 text-slate-500">
              Stripe is confirming your payment — refresh in a few seconds. If
              this page still says &ldquo;processing&rdquo; after a minute,
              email{' '}
              <a
                href="mailto:info@wonderlandplayhouse.com"
                className="font-semibold text-coral hover:text-coral-700"
              >
                info@wonderlandplayhouse.com
              </a>{' '}
              and we&rsquo;ll sort it out.
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-slate-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-600"
            >
              Back home
            </Link>
            <Link
              href="/gift-cards/buy"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400"
            >
              Send another →
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
