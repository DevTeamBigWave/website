// ============================================================================
// Funnel config + live result engine — drives the /go/* gamified quiz funnels.
//
// Rules:
//  - The funnel BRANCHES on the first answer (segment): each segment carries its
//    OWN follow-up steps + copy + reveal. Switching segment resets later picks
//    (handled in the client component).
//  - The RESULT is computed LIVE from the client's real offer (lib/pricing.ts +
//    lib/add-ons.ts) — rules-based, never AI at runtime, never hardcoded prices.
//
// Everything here is brand/offer truth for Wonderland Playhouse. No fabricated
// claims, prices, or scarcity.
// ============================================================================

import {
  PACKAGES,
  calculatePartyPricing,
  isWeekdayAfternoonDiscount,
  fmt,
  type PackageId,
} from '@/lib/pricing';
import { ADD_ON_CATALOG } from '@/lib/add-ons';

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------
export type FunnelOption = {
  value: string;
  label: string;
  hint?: string;
  emoji?: string;
};

export type FunnelStep =
  | {
      id: string;
      kind: 'single' | 'multi';
      question: string;
      help?: string;
      options: FunnelOption[];
    }
  | {
      id: string;
      kind: 'number';
      question: string;
      help?: string;
      min: number;
      max: number;
      placeholder?: string;
    };

export type FunnelSegment = {
  value: string;
  label: string;
  hint: string;
  emoji: string;
  // Copy shown the moment this segment is chosen — segment-specific.
  blurb: string;
  // Which package this priority leans toward (the result engine starts here).
  leanPackage: PackageId;
  // This segment's OWN follow-up steps.
  steps: FunnelStep[];
};

export type Funnel = {
  slug: string;
  name: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  // The branching first step.
  segmentStep: { question: string; help?: string };
  segments: FunnelSegment[];
  // Destination the reveal hands off to (the site's real booking flow).
  handoffPath: string;
};

// A shared headcount step reused by every segment (kept here so the price is
// always computed from a real number). Each segment includes it in its own
// steps array so segments stay self-contained + independently editable.
const headcountStep: FunnelStep = {
  id: 'headcount',
  kind: 'number',
  question: 'About how many kids are you expecting?',
  help: 'A best guess is fine — you can change it when you book.',
  min: 1,
  max: 40,
  placeholder: 'e.g. 15',
};

// ---------------------------------------------------------------------------
// The Party Planner quiz
// ---------------------------------------------------------------------------
export const PARTY_PLANNER: Funnel = {
  slug: 'party-planner',
  name: 'Party Planner',
  eyebrow: 'Free · 30 seconds',
  title: 'Plan your perfect party',
  subtitle:
    "Answer a few quick questions and we'll match you to the right package — with a real price, instantly.",
  segmentStep: {
    question: "What matters most for your child's party?",
    help: 'Pick the one that feels most like you.',
  },
  handoffPath: '/book',
  segments: [
    {
      value: 'privacy',
      label: 'The whole place, just us',
      hint: 'Close the venue to the public',
      emoji: '🔒',
      blurb:
        "Love it — a Private party means we close the entire venue just for your guests. No strangers, no sharing.",
      leanPackage: 'private',
      steps: [
        headcountStep,
        {
          id: 'priority',
          kind: 'single',
          question: 'What seals the deal for you?',
          help: 'This helps us tailor your reveal.',
          options: [
            { value: 'exclusive', label: 'Nobody but our guests', emoji: '🎈' },
            { value: 'longer', label: 'More than 2 hours of fun', emoji: '⏱️' },
            { value: 'hands', label: 'Extra hands — host + helper', emoji: '🙌' },
          ],
        },
      ],
    },
    {
      value: 'budget',
      label: 'Big fun, mindful budget',
      hint: 'A dedicated room, great value',
      emoji: '💛',
      blurb:
        "Smart — our Semi-Private gets you a dedicated party room while open play continues in the rest of the venue.",
      leanPackage: 'semi',
      steps: [
        headcountStep,
        {
          id: 'slot',
          kind: 'single',
          question: 'Which afternoon works best?',
          help: 'Semi-private runs one party per day.',
          options: [
            { value: '1to3', label: '1–3 pm', emoji: '☀️' },
            { value: '2to4', label: '2–4 pm', emoji: '🌤️' },
            { value: 'flexible', label: "I'm flexible", emoji: '🤷' },
          ],
        },
        {
          id: 'extras',
          kind: 'single',
          question: 'Want to add a little extra magic?',
          options: [
            { value: 'simple', label: 'Keep it simple', emoji: '✨' },
            { value: 'one_activity', label: 'One fun activity', emoji: '🎨' },
          ],
        },
      ],
    },
    {
      value: 'wow',
      label: 'Make it unforgettable',
      hint: 'Entertainment & decor, all-in',
      emoji: '🤩',
      blurb:
        "Yes! Let's make it a party they'll talk about for months — the full venue plus the fun extras.",
      leanPackage: 'private',
      steps: [
        headcountStep,
        {
          id: 'entertainment',
          kind: 'multi',
          question: 'Pick the magic (choose any):',
          help: 'We coordinate it all — finalized on your planning call.',
          options: [
            { value: 'face_painting', label: 'Face painting', emoji: '🎨' },
            { value: 'character_meet_greet', label: 'Character visit', emoji: '🦸' },
            { value: 'diy_slime', label: 'DIY slime station', emoji: '🧪' },
            { value: 'pinata', label: 'Candy piñata', emoji: '🪅' },
            { value: 'dance_games', label: 'Dance party & games', emoji: '🪩' },
            { value: 'glam_spa', label: 'Glam spa day', emoji: '💅' },
          ],
        },
        {
          id: 'decor',
          kind: 'single',
          question: 'Decorations?',
          options: [
            { value: 'full_decor', label: 'Balloons & themed decor', emoji: '🎀' },
            { value: 'byo', label: "We'll bring our own", emoji: '🎁' },
          ],
        },
      ],
    },
  ],
};

export const FUNNELS: Record<string, Funnel> = {
  [PARTY_PLANNER.slug]: PARTY_PLANNER,
};

export function getFunnel(slug: string): Funnel | null {
  return FUNNELS[slug] ?? null;
}

// ---------------------------------------------------------------------------
// Live result engine — rules only, computed from the real offer config.
// ---------------------------------------------------------------------------
export type FunnelAnswers = Record<string, string | string[]>;

export type FunnelResult = {
  packageId: PackageId;
  packageName: string;
  headcount: number;
  recommendExtension: boolean;
  // Display strings (all derived from pricing.ts)
  fromPriceLabel: string; // pre-tax subtotal, "+ tax"
  perChildLabel: string;
  depositLabel: string;
  metricLabel: string; // the one punchy stat
  summary: string[]; // specific bullets
  addOns: { name: string; priceLabel: string }[];
  // Params to hand off to /book (prefill, non-destructive on the destination)
  handoff: Record<string, string>;
};

function asString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}
function asArray(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

export function computeFunnelResult(
  funnel: Funnel,
  segmentValue: string,
  answers: FunnelAnswers,
): FunnelResult {
  const segment =
    funnel.segments.find((s) => s.value === segmentValue) ?? funnel.segments[0];
  const pkg = PACKAGES[segment.leanPackage];

  // Headcount → clamp into the package's real range (min 1, hard cap 40).
  const rawHeadcount = parseInt(asString(answers.headcount), 10);
  const headcount =
    Number.isFinite(rawHeadcount) && rawHeadcount > 0
      ? Math.min(Math.max(rawHeadcount, 1), 40)
      : pkg.includedKids;

  // Extension is recommended only when the privacy segment asks for "longer".
  const recommendExtension =
    segment.value === 'privacy' && asString(answers.priority) === 'longer';

  // Price the party from the real engine. Use a Saturday so the headline "from"
  // price is the standard (undiscounted) rate; the Mon–Thu discount is surfaced
  // separately as the punchy metric for Private.
  const saturday = new Date(2026, 0, 3); // fixed, deterministic (no Date.now)
  const pricing = calculatePartyPricing({
    packageId: segment.leanPackage,
    date: saturday,
    time: '12:00 PM',
    extensionId: recommendExtension ? '60m' : null,
    headcount,
    adultCount: 0,
  });

  const perChildCents = Math.round(pricing.subtotalCents / headcount);

  // Recommended add-ons, mapped from real selections to the real catalog.
  const addOnIds = new Set<string>();
  if (segment.value === 'wow') {
    for (const id of asArray(answers.entertainment)) addOnIds.add(id);
    if (asString(answers.decor) === 'full_decor') addOnIds.add('themed_decor');
  }
  if (segment.value === 'budget' && asString(answers.extras) === 'one_activity') {
    // A crowd-pleasing, value-friendly activity from the real catalog.
    addOnIds.add('dance_games');
  }
  const addOns = [...addOnIds]
    .map((id) => ADD_ON_CATALOG.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ name: a.name, priceLabel: `${fmt(a.price_cents)}` }));

  // The one punchy metric.
  const weekdaySavingsCents = isWeekdayAfternoonDiscount({
    packageId: 'private',
    date: new Date(2026, 0, 5), // a Monday
    time: '12:00 PM',
  })
    ? Math.round(pricing.subtotalCents * 0.2)
    : 0;
  const metricLabel =
    segment.leanPackage === 'private' && weekdaySavingsCents > 0
      ? `Save about ${fmt(weekdaySavingsCents)} — 20% off any Mon–Thu`
      : `Just ${fmt(perChildCents)} per child for your whole group`;

  // Specific, segment-aware summary bullets.
  const summary: string[] = [];
  if (segment.leanPackage === 'private') {
    summary.push('The entire venue, closed to the public — just your guests');
    summary.push(
      `${pkg.includedKids} kids included · $25 per extra kid (up to 40)`,
    );
    summary.push('2 adults included per child · dedicated host + helper');
  } else {
    summary.push('Your own dedicated party room for 2 hours');
    summary.push(
      `${pkg.includedKids} kids included · $25 per extra kid (up to 40)`,
    );
    summary.push('Dedicated party host · setup & cleanup included');
  }
  if (recommendExtension) summary.push('Plus a 1-hour extension for extra play');
  if (segment.value === 'budget') {
    const slot = asString(answers.slot);
    if (slot === '1to3') summary.push('Your 1–3 pm slot');
    else if (slot === '2to4') summary.push('Your 2–4 pm slot');
  }

  // Handoff prefill for /book (read non-destructively by BookingFlow).
  const handoff: Record<string, string> = {
    package: segment.leanPackage,
    headcount: String(headcount),
    source: funnel.slug,
  };

  return {
    packageId: segment.leanPackage,
    packageName: pkg.name,
    headcount,
    recommendExtension,
    fromPriceLabel: `${fmt(pricing.subtotalCents)} + tax`,
    perChildLabel: `${fmt(perChildCents)}/child`,
    depositLabel: `${fmt(pricing.depositCents)} deposit holds your date`,
    metricLabel,
    summary,
    addOns,
    handoff,
  };
}
