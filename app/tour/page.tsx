import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppointmentFlow } from '@/components/AppointmentFlow';

export const metadata = {
  title: 'Book a tour',
  description:
    'Come see Wonderland Playhouse in person. Free 30-minute walkthrough of our magical, low-stim play space in Brooklyn.',
};

export default function TourPage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <AppointmentFlow
        type="tour"
        eyebrow="Free tour"
        title="Come see the space."
        blurb="A quick 30-minute walkthrough — see the decor, meet us, ask anything. Best for families thinking about a party or membership."
        successHeadline="See you soon!"
      />
      <Footer />
    </>
  );
}
