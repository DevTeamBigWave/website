import Link from 'next/link';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PhotoPlaceholder } from '@/components/PhotoPlaceholder';

export const metadata = {
  title: 'Birthday Parties',
  description:
    "Brooklyn's private and semi-private birthday parties for kids 0-8. Decor, host, custom desserts, entertainment — one-stop-shop.",
};

export default function PartiesPage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <Hero />
      <Packages />
      <Difference />
      <OneStopShop />
      <AddOns />
      <Entertainment />
      <WeekdayCallout />
      <Faq />
      <FinalCta />
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-cream to-coral-50">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-coral-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-coral-700">
          Birthday Parties
        </p>
        <h1 className="font-display text-5xl leading-[1.05] text-slate-700 sm:text-6xl md:text-7xl">
          The aesthetic birthday they&rsquo;ll{' '}
          <span className="text-coral">actually remember.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500">
          A magical, low-stim venue in Brooklyn designed to look beautiful and
          feel calm. Easy sightlines so you can sit, sip, and watch — not chase.
          Add the cake, decor, and entertainment you want.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/book"
            className="rounded-full bg-coral px-7 py-4 text-base font-bold text-white shadow-playful transition hover:bg-coral-600"
          >
            Book a Party
          </Link>
          <Link
            href="/tour"
            className="rounded-full border-2 border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-600 transition hover:border-slate-400"
          >
            Free 30-min Venue Tour
          </Link>
        </div>
      </div>
    </section>
  );
}

function Packages() {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionEyebrow>Choose your package</SectionEyebrow>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Semi-Private or Private.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Semi-Private */}
          <div className="flex flex-col rounded-3xl border border-slate-100 bg-white p-8 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Package 01
            </p>
            <h3 className="mt-1 font-display text-3xl text-slate-700">Semi-Private</h3>
            <p className="mt-2 text-slate-500">
              Your dedicated party room at a set start time. Open play
              continues in the rest of the venue.
            </p>

            <p className="mt-6 font-display text-5xl text-slate-700">
              $650<span className="ml-1 text-base font-normal text-slate-400">+ tax</span>
            </p>

            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-600">
              <Bullet>10 children + the birthday child included</Bullet>
              <Bullet>$25 per extra child (up to 40 total)</Bullet>
              <Bullet>2 hours in the dedicated party room</Bullet>
              <Bullet>Dedicated party host</Bullet>
              <Bullet>Setup &amp; cleanup</Bullet>
              <Bullet>1–3pm or 2–4pm</Bullet>
              <Bullet>Open play continues in the rest of the venue</Bullet>
            </ul>

            <Link
              href="/book"
              className="mt-8 inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400"
            >
              Book Semi-Private →
            </Link>
          </div>

          {/* Private */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-coral p-8 text-white shadow-playful">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" aria-hidden />
            <div className="absolute -bottom-16 -right-8 h-40 w-40 rounded-full bg-sunshine/30" aria-hidden />

            <p className="text-xs font-bold uppercase tracking-wider text-white/80">
              Package 02 · Most popular
            </p>
            <h3 className="mt-1 font-display text-3xl">Private</h3>
            <p className="mt-2 text-white/90">
              The whole magical venue is yours. Any 2-hour window you want —
              first come, first serve.
            </p>

            <p className="mt-6 font-display text-5xl">
              $1,250<span className="ml-1 text-base font-normal text-white/80">+ tax</span>
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-sunshine">
              20% off any Mon–Thu
            </p>

            <ul className="mt-6 flex-1 space-y-2.5 text-sm font-semibold text-white/95">
              <Bullet white>15 children + the birthday child included</Bullet>
              <Bullet white>$25 per extra child (up to 40 total)</Bullet>
              <Bullet white>Entire venue — closed to the public</Bullet>
              <Bullet white>2 hours, exclusive use</Bullet>
              <Bullet white>Pick any 2-hour window (first come, first serve)</Bullet>
              <Bullet white>Dedicated host + helper</Bullet>
              <Bullet white>Setup and cleanup included</Bullet>
            </ul>

            <Link
              href="/book"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-coral transition hover:bg-cream"
            >
              Book Private →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children, white }: { children: React.ReactNode; white?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full ${
          white ? 'bg-white/20 text-white' : 'bg-coral-100 text-coral'
        }`}
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function Difference() {
  return (
    <section className="bg-cream-deep py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionEyebrow>The key difference</SectionEyebrow>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Shared space or whole space.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-500">
          That&rsquo;s the call. Everything else — host, decor, setup, cleanup,
          the activities themselves — is the same in both packages.
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">What you get</th>
                <th className="px-6 py-4 text-center">Semi-Private</th>
                <th className="px-6 py-4 text-center text-coral">Private</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <CompareRow label="Party room" semi="Yours (dedicated)" priv="Yours (dedicated)" />
              <CompareRow label="Rest of venue" semi="Open play continues" priv="Closed to the public — yours" />
              <CompareRow label="Time slots" semi="1–3pm or 2–4pm" priv="10am, 12pm, 2pm, 4pm, 6pm (negotiable)" />
              <CompareRow label="Included headcount" semi="10 + birthday child" priv="15 + birthday child" />
              <CompareRow label="Extra child" semi="$25 each" priv="$25 each" />
              <CompareRow label="Max children" semi="40" priv="40" />
              <CompareRow label="Party host" semi="✓" priv="✓ + helper" />
              <CompareRow label="Setup &amp; cleanup" semi="✓" priv="✓" />
              <CompareRow label="Mon-Thu 20% discount" semi="—" priv="Yes — all slots" />
              <tr>
                <td className="px-6 py-4 font-bold text-slate-700">Price</td>
                <td className="px-6 py-4 text-center font-display text-xl text-slate-700">$650<span className="ml-1 text-xs font-normal text-slate-400">+ tax</span></td>
                <td className="px-6 py-4 text-center font-display text-xl text-coral">$1,250<span className="ml-1 text-xs font-normal text-coral-700/70">+ tax</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CompareRow({ label, semi, priv }: { label: string; semi: string; priv: string }) {
  return (
    <tr>
      <td className="px-6 py-4 font-semibold text-slate-700">{label}</td>
      <td className="px-6 py-4 text-center text-slate-500">{semi}</td>
      <td className="px-6 py-4 text-center font-semibold text-slate-700">{priv}</td>
    </tr>
  );
}

function OneStopShop() {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <SectionEyebrow>One-stop shop</SectionEyebrow>
          <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
            One place. Zero vendor juggling.
          </h2>
          <p className="mt-4 text-slate-500">
            Host, setup, and cleanup are included with every package. Custom
            cake, themed decor, food, entertainment, goodie bags — all
            available as add-ons below, all booked in one place.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Service
            title="Themed Decor"
            blurb="Balloon arches, table styling, themed backdrops. Tell us the theme, we set it up."
            tone="coral"
          />
          <Service
            title="Custom Desserts"
            blurb="Birthday cookies, cake pops, dessert tables. From our in-house bakery."
            tone="sunshine"
          />
          <Service
            title="Entertainment"
            blurb="Bubble shows, face painting, magic, character visits. Booked with one click."
            tone="sky"
          />
          <Service
            title="Music & Playlist"
            blurb="Link your own Spotify playlist or use one of our curated kid-friendly mixes."
            tone="coral"
          />
          <Service
            title="Party Host + Helper"
            blurb="A dedicated host runs the show. Privates get a helper too. You enjoy your kid's birthday."
            tone="sunshine"
          />
          <Service
            title="Setup &amp; Cleanup"
            blurb="Arrive to a ready room. Leave when the last guest does. We take care of the rest."
            tone="sky"
          />
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <PhotoPlaceholder src="/photos/decor-02.jpeg" alt="Custom party decor at Wonderland" className="aspect-square" />
          <PhotoPlaceholder src="/photos/decor-05.jpeg" alt="Themed birthday party setup" className="aspect-square" />
          <PhotoPlaceholder src="/photos/decor-08.jpeg" alt="Balloon arrangement" className="aspect-square" />
          <PhotoPlaceholder src="/photos/decor-04.jpeg" alt="Decor detail" className="aspect-square" />
          <PhotoPlaceholder src="/photos/decor-06.jpeg" alt="Party styling" className="aspect-square" />
          <PhotoPlaceholder src="/photos/decor-09.jpeg" alt="Themed setup" className="aspect-square" />
          <PhotoPlaceholder src="/photos/decor-03.jpeg" alt="Balloon and table decor" className="aspect-square" />
          <PhotoPlaceholder src="/photos/decor-07.jpeg" alt="Birthday decor" className="aspect-square" />
        </div>
      </div>
    </section>
  );
}


function Service({
  title,
  blurb,
  tone,
}: {
  title: string;
  blurb: string;
  tone: 'coral' | 'sunshine' | 'sky';
}) {
  const styles = {
    coral: 'border-coral-200 bg-coral-50',
    sunshine: 'border-sunshine-200 bg-sunshine-50',
    sky: 'border-sky-200 bg-sky-50',
  } as const;
  return (
    <div className={`rounded-3xl border-2 ${styles[tone]} p-7`}>
      <h3 className="font-display text-xl text-slate-700">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{blurb}</p>
    </div>
  );
}

function AddOns() {
  const items = [
    { name: '1-hour extension', price: '$500 private · $250 semi-private' },
    { name: 'Outside food fee (incl. tableware for adults)', price: '$85' },
    { name: 'Case of 24 Fiji water bottles', price: '$40' },
    { name: 'Upgrade included pizzas to kosher', price: '+$30' },
    { name: 'Additional regular pizza pie', price: '$25' },
    { name: 'Additional kosher pizza pie', price: '$40' },
    { name: 'Balloons & theme-based decor', price: 'Starting at $550' },
    { name: 'Upgraded theme-based goodie bags', price: '$8 each' },
    { name: 'French fries', price: '$30' },
    { name: 'Chicken nuggets', price: '$50' },
    { name: 'Theme-based cupcakes', price: '$6 each' },
    { name: 'Custom cake', price: 'Starting at $250' },
  ];

  return (
    <section id="add-ons" className="bg-cream py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionEyebrow>Add-ons</SectionEyebrow>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Build out your party.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-500">
          Mix and match. Add what you want, skip what you don&rsquo;t. We&rsquo;ll
          confirm everything during your planning call.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span aria-hidden className="text-xl leading-none">🎈</span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                </div>
              </div>
              <p className="whitespace-nowrap font-display text-sm text-coral">
                {item.price}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Entertainment() {
  // OpenMoji codepoints — illustrated SVGs that render identically across devices
  const acts = [
    { name: 'Character meet & greet', price: '$150', note: '+$150 if mascot', icon: '1F9DA' /* fairy */ },
    { name: 'Face painting', price: '$200', icon: '1F3A8' /* palette */ },
    { name: 'Glitter tattoos', price: '$100', icon: '2728' /* sparkles */ },
    { name: 'Balloon twisting', price: '$125', icon: '1F388' /* balloon */ },
    { name: 'Dance party & games', price: '$200', icon: '1F483' /* dancing */ },
    { name: 'Candy-filled piñata', price: '$150', icon: '1FA85' /* piñata */ },
    { name: 'DIY slime station', price: '$250', icon: '1F308' /* rainbow */ },
    { name: 'DIY bracelet making station', price: '$200', icon: '1F48E' /* gem */ },
    { name: 'Glam spa day', price: '$200', icon: '1F485' /* nail polish */ },
  ];

  return (
    <section id="entertainment" className="bg-cream-deep py-20">
      <div className="mx-auto max-w-5xl px-6">
        <SectionEyebrow>Entertainment</SectionEyebrow>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Make it unforgettable.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-500">
          45-minute activities, run by our entertainers. Prices may vary by
          party size. <strong className="text-slate-700">Bubble dance party included with every option.</strong>
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {acts.map((act) => (
            <div
              key={act.name}
              className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${act.icon}.svg`}
                alt=""
                aria-hidden
                width={56}
                height={56}
                className="h-14 w-14"
                loading="lazy"
              />
              <p className="mt-3 font-display text-lg text-slate-700">{act.name}</p>
              <p className="mt-2 font-display text-2xl text-coral">{act.price}</p>
              {act.note && (
                <p className="mt-1 text-xs text-slate-500">{act.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WeekdayCallout() {
  return (
    <section className="bg-sunshine">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center md:flex-row md:text-left">
        <div className="flex-1">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-coral-700">
            Limited-time offer
          </p>
          <h2 className="font-display text-3xl text-slate-700 sm:text-4xl">
            Save 20% on Mon–Thu private parties.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-700/80">
            Any time slot Mon–Thu — the discount is automatic at checkout.
            Same space, same host, same cake.
          </p>
        </div>
        <Link
          href="/book"
          className="rounded-full bg-slate-700 px-7 py-4 text-base font-bold text-white shadow-card transition hover:bg-slate-600"
        >
          See weekday dates →
        </Link>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    {
      q: 'How do I lock in my date?',
      a: 'Pay a 50% deposit at checkout — your date is confirmed the moment Stripe processes it. The balance is due 7 days before your party.',
    },
    {
      q: 'What if I need to cancel or reschedule?',
      a: "All birthday party deposits are non-refundable. If you need to cancel your event, your party may be rescheduled to a future available date based on Wonderland Playhouse availability.\n\nPlease note that certain custom add-ons, vendors, décor, entertainment, or specialty items that have already been ordered or booked may not be refundable. We recommend notifying us as soon as possible if you need to reschedule, as some add-ons may only be transferable or refundable when sufficient notice is provided.",
    },
    {
      q: 'Can I bring my own food and cake?',
      a: 'Yes! Outside cake and food are welcome. Or order our custom desserts when you book.',
    },
    {
      q: 'How does the planning call work?',
      a: 'After you book, you\'ll get a link to schedule a planning call with us to go over theme, timing, and any add-ons. We do a second call 1 week before to finalize details.',
    },
    {
      q: 'Are waivers required?',
      a: 'Yes — every guest signs a waiver. After booking we email you a link to share with your guests so they can sign before they arrive.',
    },
    {
      q: 'Can I tour the space first?',
      a: <>Absolutely. <Link href="/tour" className="text-coral font-semibold hover:text-coral-700">Book a free 30-min tour →</Link></>,
    },
  ];

  return (
    <section className="bg-cream-deep py-20">
      <div className="mx-auto max-w-3xl px-6">
        <SectionEyebrow>Common questions</SectionEyebrow>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Things parents ask.
        </h2>

        <div className="mt-10 space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition open:shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-lg text-slate-700">
                <span>{f.q}</span>
                <span className="mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-coral-100 text-coral transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                {typeof f.a === 'string'
                  ? f.a.split('\n\n').map((para, i) => <p key={i}>{para}</p>)
                  : f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-coral py-20 text-white">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-4xl sm:text-5xl">Ready to lock in a date?</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/90">
          Most weekends book 4–6 weeks out. Best to grab a date early — you can
          always reschedule.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/book"
            className="rounded-full bg-white px-7 py-4 text-base font-bold text-coral shadow transition hover:bg-cream"
          >
            Book a Party →
          </Link>
          <Link
            href="/inquire"
            className="rounded-full border-2 border-white/30 px-7 py-4 text-base font-bold text-white transition hover:bg-white/10"
          >
            Have questions? Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">{children}</p>
  );
}
