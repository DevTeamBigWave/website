import Image from 'next/image';
import Link from 'next/link';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  description:
    "Brooklyn's magical, low-stim birthday venue and indoor play space for kids 0–8. Private & semi-private parties, drop-in open play, and memberships in Sheepshead Bay.",
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <Hero />
      <Offerings />
      <OpenPlayDetails />
      <WeekdaySpecial />
      <Visit />
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-cream to-sky-50">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-[1.05fr_1fr] md:gap-12 md:py-24">
        <div className="relative z-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-coral" />
            Brooklyn · Kids 0–8
          </p>
          <h1 className="font-display text-5xl leading-[1.05] text-slate-700 sm:text-6xl md:text-7xl">
            A magical birthday venue,{' '}
            <span className="text-coral">designed for calm.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
            Brooklyn&rsquo;s curated, low-stim private play space for kids 0–8.
            Aesthetic enough for the photos. Safe and easy enough that you can
            actually sit down.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/parties"
              className="rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600"
            >
              Book a Private Party
            </Link>
            <Link
              href="#open-play"
              className="rounded-full border-2 border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-600 transition hover:border-slate-400"
            >
              Open Play Hours
            </Link>
          </div>

          <Link
            href="/parties"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-coral hover:text-coral-700"
          >
            <span className="inline-flex items-center justify-center rounded-full bg-sunshine px-2.5 py-1 text-xs font-extrabold text-slate-700">
              20% OFF
            </span>
            All private parties Mon–Thu →
          </Link>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-card">
            <Image
              src="/hero.jpg"
              alt="Two children walking hand in hand on a magical checkerboard path"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden h-24 w-24 rounded-full bg-sunshine/80 md:block" aria-hidden />
          <div className="absolute -top-6 -right-4 hidden h-16 w-16 rounded-full bg-coral/70 md:block" aria-hidden />
        </div>
      </div>
    </section>
  );
}

function Offerings() {
  return (
    <section id="parties" className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">What we offer</p>
          <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
            One space. Three ways to play.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          <div className="relative overflow-hidden rounded-3xl bg-coral p-8 text-white shadow-playful md:col-span-3">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" aria-hidden />
            <div className="absolute -bottom-16 -right-8 h-40 w-40 rounded-full bg-sunshine/30" aria-hidden />
            <div className="relative">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/80">
                Most popular
              </p>
              <h3 className="font-display text-3xl sm:text-4xl">Private Party</h3>
              <p className="mt-3 max-w-md text-white/90">
                The whole magical venue is yours. Pick any 2-hour window —
                first come, first serve. Curated, low-stim, easy sightlines so
                you can sip your coffee while the kids play.
              </p>
              <ul className="mt-6 space-y-2 text-sm font-semibold text-white/95">
                <li>✓ 15 kids + birthday child included</li>
                <li>✓ $25 per extra kid (up to 40 total)</li>
                <li>✓ 2 hours, exclusive use of the venue</li>
                <li>✓ Dedicated host + helper</li>
                <li>✓ Setup and cleanup</li>
              </ul>
              <div className="mt-8 flex flex-wrap items-end gap-4">
                <div>
                  <p className="font-display text-4xl">$1,250<span className="ml-1 text-base font-normal text-white/80">+ tax</span></p>
                  <p className="text-xs text-white/80">flat rate · 50% deposit holds the date</p>
                </div>
                <Link
                  href="/parties"
                  className="rounded-full bg-white px-6 py-3 text-sm font-bold text-coral shadow transition hover:bg-cream"
                >
                  Book private →
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-card md:col-span-2">
            <h3 className="font-display text-2xl text-slate-700">Semi-Private</h3>
            <p className="mt-2 text-sm text-slate-500">
              Your dedicated party room. Open play continues in the rest of
              the venue.
            </p>
            <ul className="mt-5 flex-1 space-y-1.5 text-sm text-slate-600">
              <li>• 10 kids + birthday child included</li>
              <li>• $25 per extra kid (up to 40 total)</li>
              <li>• 2 hours: 1–3pm or 2–4pm</li>
              <li>• Dedicated party host</li>
              <li>• Setup &amp; cleanup</li>
            </ul>
            <div className="mt-6 flex items-end justify-between">
              <p className="font-display text-3xl text-slate-700">$650<span className="ml-1 text-sm font-normal text-slate-400">+ tax</span></p>
              <Link href="/parties" className="text-sm font-bold text-coral hover:text-coral-700">
                Book →
              </Link>
            </div>
          </div>

          <div id="open-play" className="flex flex-col rounded-3xl border-2 border-sky-200 bg-sky-50 p-7 md:col-span-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <h3 className="font-display text-2xl text-slate-700">Open Play</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Drop by for an unhurried two-hour pass. Grip socks required —
                  we sell them at the door if you forget.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="text-right">
                  <p className="font-display text-3xl text-slate-700">$25<span className="ml-1 text-sm font-normal text-slate-400">+ tax</span></p>
                  <p className="text-xs text-slate-500">per child · 2 hour pass</p>
                </div>
                <Link
                  href="/book/open-play"
                  className="rounded-full bg-slate-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-600"
                >
                  Reserve a visit →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OpenPlayDetails() {
  return (
    <section className="bg-cream-deep py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 rounded-3xl bg-white p-8 shadow-card md:grid-cols-[1fr_1.4fr] md:p-12">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">Open play, in detail</p>
            <h2 className="font-display text-3xl text-slate-700 sm:text-4xl">
              How a visit works.
            </h2>
            <p className="mt-4 text-slate-500">
              Drop in any day we&rsquo;re open — no reservation required, though
              pre-paying lets you skip the front desk.
            </p>
            <Link
              href="/book/open-play"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white shadow-playful transition hover:bg-coral-600"
            >
              Reserve a visit →
            </Link>
            <p className="mt-4 text-xs text-slate-400">
              Want unlimited visits?{' '}
              <Link href="/memberships" className="font-semibold text-coral hover:text-coral-700">
                See memberships →
              </Link>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DetailCard
              label="Per child"
              value="$25"
              note="+ tax · 2-hour pass"
              tone="coral"
            />
            <DetailCard
              label="Adults"
              value="Free"
              note="parents play free"
              tone="sky"
            />
            <DetailCard
              label="Under 10 months"
              value="Free"
              note="welcome any time"
              tone="sunshine"
            />
            <DetailCard
              label="Ages"
              value="0–8"
              note="play area for 0–8 only"
              tone="slate"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'coral' | 'sky' | 'sunshine' | 'slate';
}) {
  const toneStyles = {
    coral: 'bg-coral-50 text-coral-700',
    sky: 'bg-sky-50 text-sky-600',
    sunshine: 'bg-sunshine-50 text-slate-700',
    slate: 'bg-slate-50 text-slate-700',
  } as const;
  return (
    <div className={`rounded-2xl p-5 ${toneStyles[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      <p className="mt-1 text-xs opacity-75">{note}</p>
    </div>
  );
}

function WeekdaySpecial() {
  return (
    <section className="bg-sunshine">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center md:flex-row md:text-left">
        <div className="flex-1">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-coral-700">
            Limited-time offer
          </p>
          <h2 className="font-display text-3xl text-slate-700 sm:text-4xl">
            20% off weekday private parties.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-700/80">
            Book your child&rsquo;s private party any time Mon–Thu and
            we&rsquo;ll knock 20% off the rate. Same space, same host, same
            cake.
          </p>
        </div>
        <Link
          href="/parties"
          className="rounded-full bg-slate-700 px-7 py-4 text-base font-bold text-white shadow-card transition hover:bg-slate-600"
        >
          Check weekday dates →
        </Link>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section id="visit" className="bg-cream py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">Visit us</p>
          <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
            Come find us on Nostrand Ave.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-slate-500">
            A magical, low-stim venue tucked into Sheepshead Bay. A quick walk
            from the Q. Designed so adults can rest and kids can roam.
          </p>
        </div>

        <div className="space-y-5 rounded-3xl bg-white p-8 shadow-card">
          <Row label="Address">
            3830 Nostrand Ave
            <br />
            Brooklyn, NY 11235
          </Row>
          <Row label="Phone">
            <a href="tel:+17188891777" className="hover:text-coral">
              (718) 889-1777
            </a>
          </Row>
          <Row label="Email">
            <a href="mailto:info@wonderlandplayhouse.com" className="hover:text-coral">
              info@wonderlandplayhouse.com
            </a>
          </Row>
          <Row label="Ages">Kids 0–8</Row>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0 sm:grid sm:grid-cols-[110px_1fr] sm:items-baseline sm:gap-4">
      <dt className="text-xs font-bold uppercase tracking-wider text-coral">{label}</dt>
      <dd className="text-base text-slate-600 break-words">{children}</dd>
    </div>
  );
}
