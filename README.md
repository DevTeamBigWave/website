# Wonderland Playhouse — Web Platform

Next.js 15 (App Router) · Supabase · Stripe · Resend · Vercel

## What this is

The booking foundation for wonderlandplayhouse.com. Two flows wired into one source of truth:

- **Birthday parties** — package + date + 50% Stripe deposit, OR book a discovery call. Mon–Thu afternoon Private parties get 20% off automatically.
- **Open Play** — drop-in $25/child reservation, pay online or at the door.

Private parties auto-close the entire space for that day. The booking calendar reflects this in real time for both flows.

## Architecture in one diagram

```
┌─────────────┐                      ┌──────────────┐
│  Customer   │                      │    Owner     │
│  (browser)  │                      │   (email/SMS)│
└──────┬──────┘                      └──────▲───────┘
       │                                    │
       │ GET /api/availability              │ on confirmed booking
       ▼                                    │
┌──────────────┐    POST /api/checkout/party (recalc pricing,
│  /book flow  │───▶ create 'hold' party row, Stripe session)
└──────┬───────┘                                       │
       │                                               ▼
       │                                       ┌────────────┐
       │                                       │   Stripe   │
       │                                       │  Checkout  │
       │                                       └─────┬──────┘
       │                                             │ webhook
       ▼                                             ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase Postgres                     │
│  parties ──┬─▶ trigger ──▶ blocked_dates ──▶ /api/avail │
│  open_play │                                            │
└────────────┴────────────────────────────────────────────┘
                                                         
   confirmed status fires the trigger, which inserts into
   blocked_dates. Both flows read availability from there.
```

## Setup

```bash
pnpm install
cp .env.example .env.local
# fill in values from Supabase, Stripe, Resend dashboards

# Apply schema
supabase db push  # or paste supabase/migrations/0001_initial_schema.sql into SQL editor

# Generate types
pnpm db:types

pnpm dev
```

## Stripe webhook setup

Local dev:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the whsec_xxx into STRIPE_WEBHOOK_SECRET
```

Production: in Stripe Dashboard → Developers → Webhooks, add endpoint
`https://www.wonderlandplayhouse.com/api/webhooks/stripe` listening for:
- `checkout.session.completed`
- `checkout.session.expired`
- `charge.refunded`

## Pricing rules (single source of truth)

`lib/pricing.ts` is the only place prices live. The client UI uses it for display; the server checkout endpoint re-runs it from raw inputs to prevent tampering. Change a price here and it propagates everywhere.

## The 20% Mon–Thu rule

Hardcoded in `isWeekdayAfternoonDiscount()`:
- Package must be `private`
- Day must be Mon–Thu
- Time slot must be 12:00 PM or 2:00 PM

Want to change it later? Edit one function. Both UI and server pick it up.

## Why a 'hold' status

When the customer hits checkout, we insert a party row with `status = 'hold'` and `hold_expires_at = +30min`. This:
1. Prevents two people racing to book the same slot
2. Captures the booking even if Stripe fails or they abandon
3. Auto-cancels via `expire_stale_holds()` cron if no payment lands

`status = 'confirmed'` only after Stripe webhook fires. The `blocked_dates` trigger only fires on `confirmed`, so holds don't block anyone else.

## Cron jobs to set up

In Vercel, add these cron routes (or run via Supabase pg_cron):

| Path | Schedule | What it does |
|------|----------|--------------|
| `/api/cron/expire-holds` | Hourly | Clean up abandoned checkouts |
| `/api/cron/send-reminders` | Daily 9am | 7-day and 24-hour party reminders |
| `/api/cron/balance-due` | Daily 9am | Email parents 7 days out about balance |
| `/api/cron/post-party-review` | Daily 9am | Day-after Google review request |

(These routes aren't built yet — they're the next batch of work.)

## What's not built yet

- [ ] `/book/confirm` success page
- [ ] Cal.com embed at `/book/discovery-call`
- [ ] Cron routes (reminders, hold expiry, balance due)
- [ ] `/admin` dashboard
- [ ] Manual block-a-date UI (for staff vacations, repairs)
- [ ] Waiver signature integration
- [ ] Gift card flow
- [ ] Monthly Pass subscription (Stripe recurring)
- [ ] Homepage, About, Visit, Parties marketing pages
- [ ] LocalBusiness JSON-LD for SEO
- [ ] Google reviews embed
- [ ] Instagram feed embed
- [ ] Analytics (Plausible recommended over GA4 for a small biz)

## SEO / AI-search

The site ships indexable with a full SEO + AI-answer-engine setup:

- **No site-wide noindex.** Public pages are indexable; `robots: { index: false }` is scoped only to private routes (admin, waiver, booking-confirm, membership welcome/manage, unsubscribe, gift-card-sent).
- `app/robots.ts`, `app/sitemap.ts` — robots + sitemap, absolute URLs on the canonical domain (`lib/site.ts`).
- `app/llms.txt/route.ts` — `/llms.txt` brief for ChatGPT / Perplexity / Google AI Overviews.
- `app/opengraph-image.tsx` — generated 1200×630 share image (also serves the Twitter card).
- Per-page canonical URLs + Open Graph + Twitter card metadata.
- JSON-LD: Organization + WebSite + LocalBusiness (hours sourced from `lib/hours.ts`) in `app/layout.tsx`; FAQPage on `/parties`; BlogPosting on blog posts.
- GA4 via `components/Analytics.tsx`, gated on `NEXT_PUBLIC_GA_MEASUREMENT_ID` (the client's own property).

**After deploy — do these manually:**

1. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` (the client's GA4 `G-XXXXXXXXXX`) in the env.
2. Verify the domain in [Google Search Console](https://search.google.com/search-console) and submit `https://www.wonderlandplayhouse.com/sitemap.xml`.
3. Verify in [Bing Webmaster Tools](https://www.bing.com/webmasters) and submit the same sitemap.
4. Confirm Google picks the `www` host (canonical/robots/sitemap all use `www`); make sure the non-`www` apex 301-redirects to `www` at the DNS/host level.

## Deploy

```bash
vercel --prod
```

Vercel will pick up `next.config` and the API routes automatically. Set env vars in the Vercel dashboard or via `vercel env`.
