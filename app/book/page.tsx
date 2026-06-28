import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BookingFlow } from './BookingFlow';

export const metadata = {
  title: 'Book a Party',
  description:
    'Book a birthday party at Wonderland Playhouse. Pick a date, lock it in with a 50% deposit.',
  alternates: { canonical: '/book' },
};

type BookSearchParams = {
  cancelled?: string;
  // Funnel handoff prefills (non-destructive — see BookingFlow).
  package?: string;
  headcount?: string;
  parentName?: string;
  email?: string;
  phone?: string;
  source?: string;
};

export default function BookPage({
  searchParams,
}: {
  searchParams: Promise<BookSearchParams>;
}) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="bg-cream">
        <BookingFlowWrapper searchParams={searchParams} />
      </main>
      <Footer />
    </>
  );
}

async function BookingFlowWrapper({
  searchParams,
}: {
  searchParams: Promise<BookSearchParams>;
}) {
  const sp = await searchParams;
  const prefillPackage =
    sp.package === 'private' || sp.package === 'semi' ? sp.package : undefined;
  return (
    <BookingFlow
      cancelled={sp.cancelled === 'true'}
      prefill={{
        package: prefillPackage,
        headcount: sp.headcount,
        parentName: sp.parentName,
        email: sp.email,
        phone: sp.phone,
      }}
    />
  );
}
