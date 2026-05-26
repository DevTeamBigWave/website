import Link from 'next/link';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Memberships',
  description:
    'Wonderland Playhouse membership — $150/month, unlimited open play visits for kids 0-8 in Brooklyn.',
};

export default function MembershipsPage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <Hero />
      <Plan />
      <HowItWorks />
      <Compare />
      <Faq />
      <FinalCta />
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-cream to-sunshine-50">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sunshine-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
          Memberships
        </p>
        <h1 className="font-display text-5xl leading-[1.05] text-slate-700 sm:text-6xl md:text-7xl">
          Unlimited open play, <span className="text-coral">all month long.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500">
          One flat monthly rate. Bring your child as many days as you want.
          Cancel anytime.
        </p>
      </div>
    </section>
  );
}

function Plan() {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-coral p-10 text-white shadow-playful md:p-14">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" aria-hidden />
          <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-sunshine/30" aria-hidden />

          <div className="relative grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/80">
                The Wonderland Pass
              </p>
              <h2 className="mt-2 font-display text-4xl sm:text-5xl">Unlimited Monthly</h2>
              <p className="mt-3 max-w-md text-white/90">
                For families who come more than twice a month. Pays for itself
                on visit #3, every month.
              </p>

              <ul className="mt-7 space-y-3 text-sm font-semibold text-white">
                <Bullet>Unlimited open play visits</Bullet>
                <Bullet>One child per membership</Bullet>
                <Bullet>2-hour daily maximum</Bullet>
                <Bullet>Excludes days closed for private parties</Bullet>
                <Bullet>Cancel anytime</Bullet>
              </ul>
            </div>

            <div className="text-right">
              <p className="font-display text-7xl leading-none">$150</p>
              <p className="mt-1 text-sm text-white/85">per month + tax</p>
              <Link
                href="/memberships/join"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-coral shadow transition hover:bg-cream"
              >
                Join now →
              </Link>
              <p className="mt-3 text-xs text-white/70">
                <Link href="/memberships/manage" className="underline hover:text-white">
                  Already a member? Manage your subscription →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-white/20">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function HowItWorks() {
  return (
    <section className="bg-cream-deep py-20">
      <div className="mx-auto max-w-5xl px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">How it works</p>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Three steps. That&rsquo;s it.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Step
            n="01"
            title="Sign up"
            blurb="$150 charged monthly to your card. Cancel any time from your account or by emailing us."
          />
          <Step
            n="02"
            title="Walk in"
            blurb="Any open day, any time during open hours, unless we're closed for a private party or special event. Just show your membership at the front desk."
          />
          <Step
            n="03"
            title="Play"
            blurb="Up to 2 hours per visit, unlimited visits per month. We'll text you on private-party days."
          />
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, blurb }: { n: string; title: string; blurb: string }) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-card">
      <p className="font-display text-5xl text-coral-200">{n}</p>
      <h3 className="mt-3 font-display text-2xl text-slate-700">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{blurb}</p>
    </div>
  );
}

function Compare() {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-4xl px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">The math</p>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Pays for itself fast.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-500">
          Drop-in open play is $25 per child. A membership is $150 per month.
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl bg-white shadow-card">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Visits per month</th>
                <th className="px-6 py-4 text-center">Drop-in cost</th>
                <th className="px-6 py-4 text-center">Membership</th>
                <th className="px-6 py-4 text-center text-coral">You save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <CompareRow visits="3" dropIn="$75" save={-75} />
              <CompareRow visits="6" dropIn="$150" save={0} highlight />
              <CompareRow visits="8" dropIn="$200" save={50} />
              <CompareRow visits="12" dropIn="$300" save={150} />
              <CompareRow visits="16" dropIn="$400" save={250} />
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Break-even at 6 visits. Most active members visit 10–15 times a month.
        </p>
      </div>
    </section>
  );
}

function CompareRow({
  visits,
  dropIn,
  save,
  highlight,
}: {
  visits: string;
  dropIn: string;
  save: number;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'bg-sunshine-50' : ''}>
      <td className="px-6 py-4 font-semibold text-slate-700">{visits}</td>
      <td className="px-6 py-4 text-center text-slate-500">{dropIn}</td>
      <td className="px-6 py-4 text-center text-slate-500">$150</td>
      <td
        className={`px-6 py-4 text-center font-display text-xl ${
          save > 0 ? 'text-coral' : save === 0 ? 'text-slate-400' : 'text-slate-300'
        }`}
      >
        {save > 0 ? `+$${save}` : save === 0 ? 'Even' : `$${save}`}
      </td>
    </tr>
  );
}

function Faq() {
  const faqs = [
    {
      q: 'What does "excludes private parties" mean?',
      a: 'When the whole space is booked for a private birthday party, we close to open play that day. Members get a heads-up text the morning of any closed day.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes — cancel from your account or email us. No penalty, no questions. You\'ll keep access through the end of your current billing cycle.',
    },
    {
      q: 'Is the 2-hour daily max strict?',
      a: 'Yes. The 2-hour limit keeps the space from getting crowded and means everyone gets a good experience. Come back another day — visits are unlimited.',
    },
    {
      q: 'Can I share my membership with a sibling?',
      a: 'A membership covers one child. For families, contact us about a family rate.',
    },
    {
      q: 'Do members get a party discount?',
      a: 'Not currently — but the Mon–Thu afternoon 20% off applies to everyone. We may add member perks later.',
    },
  ];

  return (
    <section className="bg-cream-deep py-20">
      <div className="mx-auto max-w-3xl px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">Questions</p>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">Member FAQs.</h2>

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
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
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
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="font-display text-4xl sm:text-5xl">Join the Wonderland Pass.</h2>
        <p className="mx-auto mt-4 max-w-lg text-white/90">
          $150/month. Unlimited visits. No commitment beyond the next 30 days.
        </p>
        <Link
          href="/memberships/join"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-bold text-coral shadow transition hover:bg-cream"
        >
          Get started →
        </Link>
      </div>
    </section>
  );
}
