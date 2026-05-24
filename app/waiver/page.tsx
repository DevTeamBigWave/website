import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { WaiverFlow } from './WaiverFlow';

export const metadata = {
  title: 'Sign waiver',
  description:
    'Wonderland Playhouse liability waiver — sign once per year, covers all your kids.',
  robots: { index: false, follow: false },
};

export default async function WaiverPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; kiosk?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <AnnouncementBar />
      <Header />
      <WaiverFlow prefillEmail={params.email ?? ''} kiosk={params.kiosk === '1'} />
      <Footer />
    </>
  );
}
