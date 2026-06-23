import Link from 'next/link';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PhotoPlaceholder } from '@/components/PhotoPlaceholder';

export const metadata = {
  title: 'About',
  description:
    'Wonderland Playhouse is a magical, low-stim birthday venue and indoor play space in Brooklyn for kids 0-8. Open play, private birthday parties, memberships.',
};

export default function AboutPage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <Hero />
      <TheSpace />
      <WhatWeOffer />
      <ForKids />
      <Visit />
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-cream to-sky-50">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
          About Wonderland
        </p>
        <h1 className="font-display text-5xl leading-[1.05] text-slate-700 sm:text-6xl md:text-7xl">
          A soft place to land{' '}
          <span className="text-coral">for kids 0–8.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500">
          A magical, curated, low-stim play venue on Nostrand Avenue. Built by
          parents who got tired of bouncing between loud, chaotic play spaces.
        </p>
      </div>
    </section>
  );
}

function TheSpace() {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">The venue</p>
            <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
              Magical. Curated. Calm by design.
            </h2>
            <p className="mt-4 leading-relaxed text-slate-500">
              A low-stim play venue, thoughtfully arranged into gentle zones —
              climbing, dramatic play, sensory tables, art corner, infant
              lounge, and a party room that doubles as quiet space when
              there&rsquo;s no party.
            </p>
            <p className="mt-4 leading-relaxed text-slate-500">
              Music kept gentle. Lighting kept warm. Easy sightlines so adults
              can actually relax. Aesthetic enough for the photos. Safe enough
              that you can sit down.
            </p>
          </div>
          <PhotoPlaceholder
            src="/photos/space-05.jpeg"
            alt="Inside Wonderland Playhouse"
            className="aspect-[4/3]"
          />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5">
          <PhotoPlaceholder src="/photos/space-01.jpeg" alt="Wonderland Playhouse signage" className="aspect-square" />
          <PhotoPlaceholder src="/photos/space-04.jpeg" alt="Kids playing together at Wonderland" className="aspect-square" />
          <PhotoPlaceholder src="/photos/space-06.jpeg" alt="A calm moment at Wonderland" className="aspect-square" />
          <PhotoPlaceholder src="/photos/space-07.jpeg" alt="Kid climbing the soft play structure" className="aspect-square" />
          <PhotoPlaceholder src="/photos/space-08.jpeg" alt="Happy kid inside the play space" className="aspect-square" />
        </div>
      </div>
    </section>
  );
}

function WhatWeOffer() {
  return (
    <section className="bg-cream-deep py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">What we offer</p>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Four ways to play with us.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Offer
            label="Open Play"
            price="$25"
            note="per child · 2 hr pass · adults free"
            blurb="Drop in any day we're open. Two-hour pass, sock-only, grip socks required."
            href="/book/open-play"
            cta="Reserve a visit"
            tone="sky"
          />
          <Offer
            label="Memberships"
            price="$150"
            note="per month · unlimited visits"
            blurb="Unlimited open play visits, 2 hours per day max. Excludes days closed for private parties."
            href="/memberships"
            cta="See membership →"
            tone="sunshine"
          />
          <Offer
            label="Private Party"
            price="$1,250"
            note="whole venue · any 2-hour window"
            blurb="Your child's birthday, the entire space. Decor, host, cleanup — we handle it all."
            href="/parties"
            cta="Book private"
            tone="coral"
            highlight
          />
          <Offer
            label="Semi-Private Party"
            price="$650"
            note="dedicated party room · 1–3pm or 2–4pm"
            blurb="Your party gets the dedicated party room. Open play continues in the rest of the venue."
            href="/parties"
            cta="Book semi-private"
            tone="slate"
          />
        </div>
      </div>
    </section>
  );
}

function Offer({
  label,
  price,
  note,
  blurb,
  href,
  cta,
  tone,
  highlight,
}: {
  label: string;
  price: string;
  note: string;
  blurb: string;
  href: string;
  cta: string;
  tone: 'coral' | 'sky' | 'sunshine' | 'slate';
  highlight?: boolean;
}) {
  if (highlight) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-coral p-8 text-white shadow-playful">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">{label}</p>
        <p className="mt-2 font-display text-5xl">{price}</p>
        <p className="text-xs text-white/80">{note}</p>
        <p className="mt-4 text-sm text-white/90">{blurb}</p>
        <Link
          href={href}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-coral transition hover:bg-cream"
        >
          {cta} →
        </Link>
      </div>
    );
  }

  const toneStyles = {
    coral: 'border-coral-200 bg-coral-50',
    sky: 'border-sky-200 bg-sky-50',
    sunshine: 'border-sunshine-200 bg-sunshine-50',
    slate: 'border-slate-100 bg-white',
  } as const;

  return (
    <div className={`rounded-3xl border-2 ${toneStyles[tone]} p-8`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 font-display text-5xl text-slate-700">{price}</p>
      <p className="text-xs text-slate-500">{note}</p>
      <p className="mt-4 text-sm text-slate-600">{blurb}</p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-coral hover:text-coral-700"
      >
        {cta}
      </Link>
    </div>
  );
}

function ForKids() {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">Designed for</p>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Kids ages 0–8.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-500">
          Every play structure, sensory station, and activity is built for
          toddlers through early elementary. Older kids will find it small;
          younger kids will find it exactly right.
        </p>

        <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
          <AgeCard
            range="0–10 mo"
            title="Infant lounge"
            note="Free, every visit. Soft mats, quiet corner, nursing-friendly."
          />
          <AgeCard
            range="10 mo–4"
            title="Toddler zones"
            note="Climbing, sensory tables, dramatic play, all toddler-sized."
          />
          <AgeCard
            range="4–8"
            title="Big kid play"
            note="Bigger structures, art corner, themed parties, the works."
          />
        </div>
      </div>
    </section>
  );
}

function AgeCard({ range, title, note }: { range: string; title: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-coral">{range}</p>
      <h3 className="mt-2 font-display text-xl text-slate-700">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function Visit() {
  return (
    <section className="bg-coral py-20 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2 md:items-center">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/80">Visit</p>
          <h2 className="font-display text-4xl sm:text-5xl">Come see the space.</h2>
          <p className="mt-4 max-w-md leading-relaxed text-white/90">
            Free 30-minute venue tours, by appointment. The best way to decide
            if Wonderland is the right fit for your child or your child&rsquo;s
            party.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/tour"
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-coral transition hover:bg-cream"
            >
              Book a free tour →
            </Link>
            <Link
              href="/book/open-play"
              className="rounded-full border-2 border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Reserve open play
            </Link>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl bg-white/10 p-7 backdrop-blur">
          <Row label="Address">
            3830 Nostrand Ave
            <br />
            Brooklyn, NY 11235
          </Row>
          <Row label="Phone"><a href="tel:+17188891777" className="hover:underline">(718) 889-1777</a></Row>
          <Row label="Email"><a href="mailto:info@wonderlandplayhouse.com" className="hover:underline">info@wonderlandplayhouse.com</a></Row>
          <Row label="Ages">Kids 0–8</Row>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-baseline gap-4 border-b border-white/15 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-bold uppercase tracking-wider text-white/70">{label}</dt>
      <dd className="text-base text-white">{children}</dd>
    </div>
  );
}
