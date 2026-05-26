import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ManageForm } from './ManageForm';

export const metadata = {
  title: 'Manage membership',
  robots: { index: false, follow: false },
};

export default function ManagePage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <div className="mx-auto max-w-xl px-6 py-16 md:py-20">
        <p className="text-xs font-bold uppercase tracking-wider text-coral">
          Members
        </p>
        <h1 className="mt-2 font-display text-4xl text-slate-700">
          Manage your membership.
        </h1>
        <p className="mt-3 text-slate-500">
          Update your payment method, see your billing history, or cancel —
          all in the secure Stripe portal.
        </p>
        <ManageForm />
      </div>
      <Footer />
    </>
  );
}
