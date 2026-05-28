import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnnouncementBar, Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabaseAdmin } from '@/lib/supabase';
import { computePartyFinancials } from '@/lib/parties';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Booking confirmed',
  robots: { index: false, follow: false },
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    party_id?: string;
    op?: string;
    gift?: string;
    session_id?: string;
  }>;
}) {
  const sp = await searchParams;

  if (sp.party_id) {
    return <PartyConfirm partyId={sp.party_id} giftFlag={sp.gift === '1'} />;
  }
  if (sp.op) {
    return <OpenPlayConfirm ticketCode={sp.op} giftFlag={sp.gift === '1'} />;
  }
  notFound();
}

async function PartyConfirm({ partyId, giftFlag }: { partyId: string; giftFlag: boolean }) {
  const db = supabaseAdmin();
  const { data: party } = await db
    .from('parties')
    .select(
      'id, parent_name, email, child_name, child_age, date, start_time, package, status, headcount, total_cents, deposit_cents, deposit_paid_at, add_ons_total_cents, gift_card_applied_cents, balance_paid_amount_cents, manual_discount_percent, manual_discount_cents, promo_code_id',
    )
    .eq('id', partyId)
    .maybeSingle();

  if (!party) notFound();

  // Promo-code booking: no deposit was actually paid. Render different copy.
  const isPromoBooking = !party.deposit_paid_at && !!party.promo_code_id;
  // Use the same finance helper as admin / emails / calendar so this page
  // stays accurate if add-ons or a F&F discount get applied later.
  const fin = computePartyFinancials(party as any);

  return (
    <>
      <AnnouncementBar />
      <Header />
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
            {party.status === 'confirmed' ? 'Date locked in ✓' : 'Processing…'}
          </p>
          <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
            {party.status === 'confirmed'
              ? `${party.child_name ?? "Your child"}'s party is booked.`
              : 'Almost there — finalizing your booking.'}
          </h1>
          <p className="mt-3 text-slate-500">
            {party.status === 'confirmed' ? (
              <>
                We&rsquo;ve got you down for <strong>{fmtDate(party.date)}</strong> at{' '}
                <strong>{formatTime(party.start_time)}</strong>. Confirmation email
                sent to <strong>{party.email}</strong>.
                {isPromoBooking && (
                  <>
                    {' '}
                    We&rsquo;ll send your invoice separately — no card was charged today.
                  </>
                )}
              </>
            ) : (
              <>
                Stripe is finalizing the payment — refresh in a few seconds. If this
                page still says &ldquo;processing&rdquo; after a minute, email{' '}
                <a href="mailto:info@wonderlandplayhouse.com" className="text-coral hover:text-coral-700 font-semibold">
                  info@wonderlandplayhouse.com
                </a>.
              </>
            )}
          </p>

          {party.status === 'confirmed' && (
            <div className="mt-6 rounded-2xl bg-cream-deep p-5 text-sm">
              <Row label="Package">{party.package === 'private' ? 'Private' : 'Semi-Private'}</Row>
              <Row label="Headcount">{party.headcount} kids</Row>
              <Row label="Total">{fmt(fin.grand_total_cents)}</Row>
              {isPromoBooking ? (
                <Row label="Balance owed">
                  <strong>{fmt(fin.balance_due_cents)}</strong> · invoice on the way
                </Row>
              ) : (
                <>
                  <Row label={giftFlag ? 'Covered by gift card' : 'Deposit paid'}>
                    {fmt(party.deposit_cents)} {giftFlag ? '🎁' : '✓'}
                  </Row>
                  <Row label="Balance due 7 days before">
                    {fmt(fin.balance_due_cents)}
                  </Row>
                </>
              )}
            </div>
          )}
        </div>

        <WaiverCard email={party.email} />

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-slate-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-600"
          >
            Back home
          </Link>
          <Link
            href="/parties"
            className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400"
          >
            See party details
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}

async function OpenPlayConfirm({ ticketCode, giftFlag }: { ticketCode: string; giftFlag: boolean }) {
  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from('open_play')
    .select('id, parent_name, email, date, num_children, total_cents, status, ticket_code, payment_method')
    .eq('ticket_code', ticketCode)
    .maybeSingle();

  if (!ticket) notFound();

  const paid = ticket.status === 'paid' || ticket.payment_method === 'at_door';

  return (
    <>
      <AnnouncementBar />
      <Header />
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <div className="rounded-3xl bg-white p-8 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
            {paid ? 'Reserved ✓' : 'Processing…'}
          </p>
          <h1 className="mt-2 font-display text-4xl text-slate-700 sm:text-5xl">
            {paid ? 'See you soon.' : 'Almost there…'}
          </h1>
          <p className="mt-3 text-slate-500">
            {paid ? (
              <>
                Open play for {ticket.num_children} {ticket.num_children === 1 ? 'kid' : 'kids'} on{' '}
                <strong>{fmtDate(ticket.date)}</strong>. Confirmation email sent to{' '}
                <strong>{ticket.email}</strong>.
              </>
            ) : (
              <>
                Stripe is finalizing the payment — refresh in a few seconds.
              </>
            )}
          </p>

          {paid && (
            <div className="mt-6 rounded-2xl bg-cream-deep p-5 text-sm">
              <Row label="Ticket code">
                <span className="font-mono font-bold">{ticket.ticket_code}</span>
              </Row>
              <Row label="Kids">{ticket.num_children}</Row>
              <Row label="Date">{fmtDate(ticket.date)}</Row>
              <Row label={ticket.payment_method === 'at_door' ? 'Paid at door' : 'Total paid'}>
                {fmt(ticket.total_cents)} {giftFlag ? '🎁' : ticket.payment_method === 'at_door' ? '— pay on arrival' : '✓'}
              </Row>
            </div>
          )}
        </div>

        <WaiverCard email={ticket.email} />

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-slate-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-600"
          >
            Back home
          </Link>
          <Link
            href="/book/open-play"
            className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400"
          >
            Book another day
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}

function WaiverCard({ email }: { email: string }) {
  return (
    <div className="mt-6 rounded-3xl bg-coral p-7 text-white shadow-playful sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wider text-sunshine">
        While you&rsquo;re here
      </p>
      <h2 className="mt-2 font-display text-2xl text-white sm:text-3xl">
        Sign your waiver now — skip the desk paperwork.
      </h2>
      <p className="mt-2 text-white/90">
        Once a year covers every kid you bring — birthday parties, open play, guests.
        Takes 90 seconds and we&rsquo;ll have you on file before you arrive.
      </p>
      <Link
        href={`/waiver?email=${encodeURIComponent(email)}`}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-coral shadow transition hover:bg-cream"
      >
        Sign waiver →
      </Link>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-200/60 py-2 last:border-b-0">
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}
