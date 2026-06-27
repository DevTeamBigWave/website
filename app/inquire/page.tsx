import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppointmentFlow } from '@/components/AppointmentFlow';

export const metadata = {
  title: 'Book a call',
  description:
    'Talk to us about your birthday party, membership, or anything else. Free 20-minute call.',
  alternates: { canonical: '/inquire' },
};

export default function InquirePage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <AppointmentFlow
        type="inquiry"
        eyebrow="Free call"
        title="Let's talk it through."
        blurb="Prefer to chat before booking online? Pick a time and we'll call. We can walk through packages, dates, add-ons — whatever you want to figure out."
        successHeadline="Talk soon!"
      />
      <Footer />
    </>
  );
}
