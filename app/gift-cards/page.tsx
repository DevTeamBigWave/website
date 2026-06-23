import Link from 'next/link';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Gift Cards',
  description:
    'Wonderland Playhouse gift cards — $25 to $250 or custom amounts. Redeemable for parties, open play, and memberships.',
};

const DENOMINATIONS = [
  { amount: 25, note: '1 open play visit' },
  { amount: 50, note: '2 visits or a head start on a party' },
  { amount: 100, note: 'A great parents\' night out gift' },
  { amount: 250, note: 'Covers most of a Semi-Private deposit' },
];

export default function GiftCardsPage() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <Hero />
      <Amounts />
      <HowItWorks />
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
          Gift Cards
        </p>
        <h1 className="font-display text-5xl leading-[1.05] text-slate-700 sm:text-6xl md:text-7xl">
          Give them <span className="text-coral">two great hours.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500">
          Redeemable for open play visits, party deposits, or memberships.
          The kind of gift parents actually want.
        </p>
      </div>
    </section>
  );
}

function Amounts() {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">Choose an amount</p>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Four amounts, or pick your own.
        </h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DENOMINATIONS.map((d) => (
            <DenomCard key={d.amount} amount={d.amount} note={d.note} />
          ))}
        </div>

        <div className="mt-6 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-coral">Custom amount</p>
          <p className="mt-2 font-display text-2xl text-slate-700">
            Want a different amount?
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Any amount $25 and up — perfect for splitting between guests on a group gift.
          </p>
          <Link
            href="/gift-cards/buy"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-600"
          >
            Pick a custom amount →
          </Link>
        </div>
      </div>
    </section>
  );
}

function DenomCard({ amount, note }: { amount: number; note: string }) {
  return (
    <div className="flex flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-card">
      <p className="font-display text-5xl text-slate-700">${amount}</p>
      <p className="mt-2 text-xs uppercase tracking-wider text-slate-400">Gift card</p>
      <p className="mt-3 flex-1 text-sm text-slate-600">{note}</p>
      <Link
        href={`/gift-cards/buy?amount=${amount}`}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-playful transition hover:bg-coral-600"
      >
        Send a ${amount} card →
      </Link>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="bg-cream-deep py-20">
      <div className="mx-auto max-w-5xl px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">How it works</p>
        <h2 className="font-display text-4xl text-slate-700 sm:text-5xl">
          Send in two minutes.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Step
            n="01"
            title="Pick an amount"
            blurb="Choose $25, $50, $100, $250, or any custom amount."
          />
          <Step
            n="02"
            title="Add a message"
            blurb="Recipient's name, your name, a short note. We'll handle the rest."
          />
          <Step
            n="03"
            title="They redeem"
            blurb="Recipient gets a code by email. Redeemable for any visit, party, or membership."
          />
        </div>

        <div className="mt-12 rounded-3xl bg-sunshine-50 border-2 border-sunshine-200 p-6 text-center text-sm text-slate-700">
          <strong>No expiration.</strong> Partial balances stick around — a
          $100 card covers a $25 visit and leaves $75 for next time.
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

function FinalCta() {
  return (
    <section className="bg-coral py-20 text-white">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="font-display text-4xl sm:text-5xl">A gift for the kid who has everything.</h2>
        <p className="mx-auto mt-4 max-w-lg text-white/90">
          Two unhurried hours of imaginative play. They&rsquo;ll thank you.
          Their parents will thank you more.
        </p>
        <Link
          href="/gift-cards/buy"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-bold text-coral shadow transition hover:bg-cream"
        >
          Buy a gift card →
        </Link>
      </div>
    </section>
  );
}
