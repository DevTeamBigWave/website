import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BookingFlow } from './BookingFlow';

export const metadata = {
  title: 'Book a Party',
  description:
    'Book a birthday party at Wonderland Playhouse. Pick a date, lock it in with a 50% deposit.',
};

export default function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
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
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const sp = await searchParams;
  return <BookingFlow cancelled={sp.cancelled === 'true'} />;
}
