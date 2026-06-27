import { SITE_URL } from '@/lib/site';

// /llms.txt — a clean markdown brief for AI answer engines (ChatGPT, Perplexity,
// Google AI Overviews). Plain facts + key links so the site can be cited
// accurately. Served as text/plain so it renders raw.
export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# Wonderland Playhouse

> A magical, low-stim birthday venue and indoor play space in Brooklyn, NY for kids ages 0–8. Designed for calm: warm lighting, gentle music, easy sightlines so adults can relax while kids play. Private and semi-private birthday parties, drop-in open play, and memberships.

## Key facts
- Location: 3830 Nostrand Ave, Brooklyn, NY 11235 (Sheepshead Bay)
- Phone: (718) 889-1777
- Email: info@wonderlandplayhouse.com
- Hours: 11am–7pm every day (open play pauses only during a booked private party's window)
- Ages: kids 0–8 only (children 9+ are not permitted in the play area)
- Service area: Brooklyn, NY and the surrounding NYC area
- Grip socks required for everyone (sold at the door)

## What we offer
- **Private Parties** — the entire venue, closed to the public, just for your party. $1,250 + tax flat rate. Includes 15 children + the birthday child (each extra child $25, up to 40). 2 adults included per child; extra adults $10 each. 2 hours of exclusive use, dedicated host + helper, setup and cleanup. Book: ${SITE_URL}/book
- **Semi-Private Parties** — your dedicated party room while open play continues elsewhere in the venue. $650 + tax flat rate. Includes 10 children + the birthday child (each extra child $25, up to 40). 2 adults included per child; extra adults $10 each. Two slot options (1–3pm or 2–4pm). Book: ${SITE_URL}/book
- **Open Play** — drop-in visits. $25 per child + tax, 2-hour pass. Adults play free; children under 10 months free. Reserve: ${SITE_URL}/book/open-play
- **Memberships (The Wonderland Pass)** — $150/month, unlimited open play visits for one child (2 hours/day max). Cancel anytime. Join: ${SITE_URL}/memberships/join
- **Gift Cards** — any amount from $25; redeemable for open play, parties, memberships, or add-ons. Buy: ${SITE_URL}/gift-cards

## Offers
- 20% off Private parties booked Monday–Thursday (any time slot). Automatic at checkout.

## Booking & policies
- Parties: 50% deposit secures the date at checkout (Stripe); balance due 7 days before. Deposits are non-refundable; dates may be rescheduled subject to availability.
- Online party booking covers the next 6 months; for dates further out, book a free call.
- Every guest signs a waiver (link emailed after booking).
- 8.875% NYC sales tax applies to all bookings.

## Key links
- Home: ${SITE_URL}/
- Birthday parties (info): ${SITE_URL}/parties
- Book a party: ${SITE_URL}/book
- Reserve open play: ${SITE_URL}/book/open-play
- Memberships: ${SITE_URL}/memberships
- Gift cards: ${SITE_URL}/gift-cards
- Free venue tour: ${SITE_URL}/tour
- Book a call / inquire: ${SITE_URL}/inquire
- About: ${SITE_URL}/about
- Blog: ${SITE_URL}/blog

## Contact
- Phone: (718) 889-1777
- Email: info@wonderlandplayhouse.com
- Instagram: https://www.instagram.com/wonderlandplayhouseny
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
