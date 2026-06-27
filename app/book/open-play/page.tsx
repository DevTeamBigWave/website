import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { OpenPlayFlow } from './OpenPlayFlow';

export const metadata = {
  title: 'Reserve Open Play',
  description:
    'Reserve a 2-hour open play visit at Wonderland Playhouse. $25 per child + tax. Adults free, under 10 months free.',
  alternates: { canonical: '/book/open-play' },
};

export default function BookOpenPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="bg-cream">
        <Wrapper searchParams={searchParams} />
      </main>
      <Footer />
    </>
  );
}

async function Wrapper({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const sp = await searchParams;
  return <OpenPlayFlow cancelled={sp.cancelled === 'true'} />;
}
