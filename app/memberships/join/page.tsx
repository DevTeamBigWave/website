import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { JoinMembershipForm } from './JoinMembershipForm';

export const metadata = {
  title: 'Join the Wonderland Pass',
  description:
    '$150/month unlimited open play for one child. Cancel anytime. Sign up online.',
};

export default function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          Wonderland Pass
        </p>
        <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
          $150/month. Cancel anytime.
        </h1>
        <p className="mt-4 text-slate-500">
          Unlimited open play for one child, 7 days a week, up to 2 hours a day —
          except when we&rsquo;re closed for a private party.
        </p>
        <JoinMembershipForm searchParams={searchParams} />
      </div>
      <Footer />
    </>
  );
}
