# Tech stack & service handover

Everything below powers wonderlandplayhouse.com. Login column tells you which account to use to access each service.

## Login accounts

- **Gaby's personal Google** is used for: Anthropic Claude (the AI used to build + maintain the site)
- **info@wonderlandplayhouse.com** (sign in with Google OR GitHub) is used for: everything else — GitHub, Railway, Supabase, Stripe, Resend, cron-job.org, Cal.com, Google Cloud Console, Google Business Profile, Clover, Homebase

---

## Code & deployment

| Service | Login | What it does |
| --- | --- | --- |
| **GitHub** — repo `wonderlandplayhouse/website` | info@ via GitHub | Source code lives here. Every change is a git commit. Push to the production branch and Railway auto-deploys. |
| **Railway** | info@ via GitHub | Hosts the live site. Auto-builds and deploys on every push. Environment variables (Stripe keys, API tokens, etc) are configured in the Railway dashboard → Variables tab. |
| **Squarespace Domains** | info@ via Google | Owns the `wonderlandplayhouse.com` domain + DNS. Apex domain forwards to `www.wonderlandplayhouse.com`. Squarespace nameservers point at Railway's CDN. |
| **Cloudflare** (none) | — | Not used. Was considered, deemed unnecessary. |

---

## Backend services

| Service | Login | What it does |
| --- | --- | --- |
| **Supabase** | info@ via GitHub | Postgres database (parties, customers, memberships, gift cards, waivers, blog posts, etc.), admin auth, file storage (party inspiration photos in the `party-inspiration` bucket). All migrations live in `supabase/migrations/`. |
| **Stripe** | info@ via Google | Payment processing — party deposits, balance invoices, gift card sales, membership subscriptions, open play tickets. Webhook fires back into the site at `/api/webhooks/stripe` on every payment event. **Currently in LIVE mode.** |
| **Resend** | info@ via Google | Sends every transactional email (booking confirmations, balance invoices, party reminders, gift card delivery, membership welcome, owner notifications, etc.). 12+ branded templates in `lib/email.ts`. Sending domain is `wonderlandplayhouse.com`. |
| **cron-job.org** | info@ via Google | Runs scheduled jobs. Each cron hits a `/api/cron/<name>` URL with the `x-cron-secret` header. Active crons: party-reminders (daily), weekly-blog (Mon), birthday-reminders (daily), weekly-marketing (Thu), sync-clover (daily), import-homebase (daily), sync-gbp-hours (daily), rotate-promo-code (1st of each month). |

---

## Integrations

| Service | Login | What it does |
| --- | --- | --- |
| **Google Calendar** | info@ via Google | Every confirmed party creates an event on the venue's Google Calendar (with the parent invited via .ics). Admins connect their Google account once via `/admin/integrations/google`. Events get deleted when the party is deleted in admin. |
| **Google OAuth (Cloud Console)** | info@ via Google | The OAuth client used for admin sign-in + the calendar integration. One client serves both. Lives at console.cloud.google.com. |
| **Google Business Profile** | info@ via Google | The "Wonderland Playhouse" listing on Google Maps. The site syncs party-day closures to GBP special hours nightly via `/api/cron/sync-gbp-hours`. *Currently paused* — Google's free-tier API quota is 0 and we have a quota-increase request pending with them. |
| **Clover** | info@ via Google | The in-store POS system. The site pulls Clover sales data daily into `clover_payments` so `/admin/revenue` can show in-store + online totals together. Read-only sync, no writes back. |
| **Homebase** | info@ via Google | Employee scheduling tool. Homebase emails a CSV report; a cron parses it (`/api/cron/import-homebase`) into `daily_labor` so `/admin/labor` can show shift hours + cost. |
| **Cal.com** | info@ via Google | Embedded discovery-call scheduling widget (used on `/inquire` and the post-deposit planning-call invite email). Booking page slug lives in `NEXT_PUBLIC_CAL_LINK` env var. |
| **Anthropic Claude (API)** | Gaby's personal Google | Powers the live customer chat widget on the site, the weekly blog auto-generator, and the weekly marketing email drafts. API key is on Anthropic Console, the chat widget renders bottom-right of every public page. |

---

## Framework + libraries (what the code is built with)

- **Next.js 15** (App Router) — the web framework
- **React 19** — UI library
- **TypeScript** — typed JavaScript; everything is type-checked at build
- **Tailwind CSS 3** — utility-first styling
- **Zod** — input validation on every API route
- **@supabase/ssr** + **@supabase/supabase-js** — Supabase clients (server + client)
- **stripe** — official Stripe Node SDK
- **resend** — Resend SDK for transactional email
- **@anthropic-ai/sdk** — Claude SDK
- **qrcode** — generates the waiver QR + ticket QR images
- **date-fns** — date formatting helpers
- **lucide-react** — icon set (used sparingly; most icons are inline SVG)

---

## Where to find what

- **Migrations**: `supabase/migrations/` — apply them in Supabase SQL editor in numerical order if migrating to a new project
- **Env var template**: `.env.example` — every secret the app expects, with stub values
- **Email templates**: `lib/email.ts` — every customer + owner email
- **Pricing rules**: `lib/pricing.ts` — package prices, Mon-Thu discount logic, deposit %, tax rate
- **Add-on catalog**: `lib/add-ons.ts` — single source of truth, both customer /book and admin pages render from this
- **Admin login allowlist**: `admin_users` table in Supabase — emails added here can sign in to `/admin`
- **Cron job URLs**: each `/api/cron/*` route file documents its expected schedule in the top comment

---

## Things to know for ongoing operations

- **Stripe is in LIVE mode.** Real cards work. Use a test key swap on Railway env if you ever need to run a no-charge end-to-end test.
- **Promo codes** (`/admin/promo-codes`) let you book a party without paying the deposit upfront. A new code auto-generates on the 1st of each month. Use these for friends/family or QA testing.
- **Manual payment recording**: when a customer Zelles, pays cash, or swipes Clover, mark it in admin (`/admin/parties/[id]` → "Record payment received" card → Zelle / Cash / Clover). This closes the Stripe invoice as "paid out of band" and emails the customer a receipt.
- **Refund policy is intentionally narrow**: deposits are non-refundable, dates can be rescheduled. This is in the FAQ, every confirmation email, every invoice footer, and the chat assistant's system prompt.
- **Booking window** is 6 months out on `/book`. Anything further requires a phone call.
