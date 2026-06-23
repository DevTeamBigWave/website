import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { GiftCardCheckoutForm } from './GiftCardCheckoutForm';

export const metadata = {
  title: 'Buy a gift card',
  description:
    'Send a Wonderland Playhouse gift card. Recipient gets a code by email — redeemable for parties, open play visits, and more.',
};

export default function BuyGiftCardPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; cancelled?: string }>;
}) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <GiftCardPageBody searchParams={searchParams} />
      <Footer />
    </>
  );
}

async function GiftCardPageBody({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; cancelled?: string }>;
}) {
  const params = await searchParams;
  const presetAmount = params.amount ? parseInt(params.amount, 10) : null;
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">Gift card</p>
        <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
          Send a Wonderland gift card.
        </h1>
        <p className="mt-3 text-slate-500">
          They get a code by email — redeemable for parties, open play, and
          more. No expiration. Partial balances stick around.
        </p>
      </div>
      {params.cancelled && (
        <div className="mt-6 rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">
          Checkout was cancelled — your card wasn&rsquo;t charged.
        </div>
      )}
      <GiftCardCheckoutForm presetAmount={presetAmount} />
    </div>
  );
}
