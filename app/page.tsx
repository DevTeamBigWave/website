import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <Hero />
      <Offerings />
      <WeekdaySpecial />
      <Visit />
      <Footer />
    </>
  );
}

function AnnouncementBar() {
  return (
    <div className="bg-coral text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-semibold">
        <span aria-hidden>🎉</span>
        <span>
          Limited-time offer: 20% off private parties Mon–Thu, 12pm &amp; 2pm slots
        </span>
        <Link
          href="/book"
          className="ml-2 hidden rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold underline-offset-2 hover:bg-white/30 sm:inline-flex"
        >
          Book now →
        </Link>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-slate-100 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Wonderland Playhouse"
            width={140}
            height={90}
            priority
            className="h-12 w-auto md:h-14"
          />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
          <Link href="#parties" className="hover:text-coral">Parties</Link>
          <Link href="#open-play" className="hover:text-coral">Open Play</Link>
          <Link href="#visit" className="hover:text-coral">Visit</Link>
          <Link
            href="/book"
            className="rounded-full bg-coral px-5 py-2.5 text-white shadow-playful transition hover:bg-coral-600"
          >
            Book a Party
          </Link>
        </nav>
        <Link
          href="/book"
          className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white shadow-playful md:hidden"
        >
          Book
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-cream to-sky-50">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-[1.05fr_1fr] md:gap-12 md:py-24">
        <div className="relative z-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-coral" />
            Brooklyn · Kids 0–7
          </p>
          <h1 className="font-display text-5xl leading-[1.05] text-slate-700 sm:text-6xl md:text-7xl">
            Your child&rsquo;s birthday,{' '}
            <span className="text-coral">the whole 4,000 sq&nbsp;ft.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
            Brooklyn&rsquo;s private play space for kids 0–7. We handle setup,
            host, and cleanup. You bring the cake.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/book"
              className="rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600"
            >
              Book a Private Party
            </Link>
            <Link
              href="/book/open-play"
              className="rounded-full border-2 border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-600 transition hover:border-slate-400"
            >
              Open Play Hours
            </Link>
          </div>

          <Link
            href="/book"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-coral hover:text-coral-700"
          >
            <span className="inline-flex items-center justify-center rounded-full bg-sunshine px-2.5 py-1 text-xs font-extrabold text-slate-700">
              20% OFF
            </span>
            Weekday afternoons — Mon–Thu at 12pm or 2pm →
          </Link>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-card">
            <Image
              src="/hero.png"
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
          {/* Private — the hero offering */}
          <div className="relative overflow-hidden rounded-3xl bg-coral p-8 text-white shadow-playful md:col-span-3">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" aria-hidden />
            <div className="absolute -bottom-16 -right-8 h-40 w-40 rounded-full bg-sunshine/30" aria-hidden />
            <div className="relative">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/80">
                Most popular
              </p>
              <h3 className="font-display text-3xl sm:text-4xl">Private Party</h3>
              <p className="mt-3 max-w-md text-white/90">
                The entire 4,000 sq ft is yours. No other families, no shared
                play areas — just your guests, your music, your celebration.
              </p>
              <ul className="mt-6 space-y-2 text-sm font-semibold text-white/95">
                <li>✓ Up to 25 children</li>
                <li>✓ 2 hours, exclusive use of the space</li>
                <li>✓ Dedicated host + helper</li>
                <li>✓ Setup, cleanup, themed decor</li>
              </ul>
              <div className="mt-8 flex flex-wrap items-end gap-4">
                <div>
                  <p className="font-display text-4xl">$1,250</p>
                  <p className="text-xs text-white/80">flat rate · 50% deposit holds the date</p>
                </div>
                <Link
                  href="/book"
                  className="rounded-full bg-white px-6 py-3 text-sm font-bold text-coral shadow transition hover:bg-cream"
                >
                  Book private →
                </Link>
              </div>
            </div>
          </div>

          {/* Semi-Private */}
          <div className="flex flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-card md:col-span-2">
            <h3 className="font-display text-2xl text-slate-700">Semi-Private</h3>
            <p className="mt-2 text-sm text-slate-500">
              Your party, shared with a few other families in the space.
            </p>
            <ul className="mt-5 flex-1 space-y-1.5 text-sm text-slate-600">
              <li>• Up to 15 children</li>
              <li>• 2 hours of play</li>
              <li>• Dedicated party host</li>
              <li>• Setup &amp; cleanup</li>
            </ul>
            <div className="mt-6 flex items-end justify-between">
              <p className="font-display text-3xl text-slate-700">$650</p>
              <Link
                href="/book"
                className="text-sm font-bold text-coral hover:text-coral-700"
              >
                Book →
              </Link>
            </div>
          </div>

          {/* Open Play */}
          <div
            id="open-play"
            className="flex flex-col rounded-3xl border-2 border-sky-200 bg-sky-50 p-7 md:col-span-5"
          >
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
                  <p className="font-display text-3xl text-slate-700">$25</p>
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
            Book your child&rsquo;s private party Mon–Thu at the 12pm or 2pm
            slot and we&rsquo;ll knock 20% off the rate. Same space, same host,
            same cake.
          </p>
        </div>
        <Link
          href="/book"
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
            4,000 square feet of unhurried, imaginative play tucked between Avenue X
            and Avenue Y. Free street parking, and a quick walk from the Q at
            Sheepshead Bay.
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
          <Row label="Ages">Kids 0–7</Row>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <dt className="text-xs font-bold uppercase tracking-wider text-coral">{label}</dt>
      <dd className="text-base text-slate-600">{children}</dd>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-700 py-12 text-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <Image
          src="/logo.png"
          alt="Wonderland Playhouse"
          width={120}
          height={80}
          className="h-12 w-auto opacity-90"
        />
        <p className="text-xs opacity-70">
          © {new Date().getFullYear()} Wonderland Playhouse · 3830 Nostrand Ave, Brooklyn NY 11235
        </p>
      </div>
    </footer>
  );
}
