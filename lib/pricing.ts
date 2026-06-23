// ============================================================================
// Pricing — single source of truth for all party math
// Used by: client booking UI (display) AND server checkout endpoint (authoritative)
// Server always re-runs these calcs from raw inputs to prevent client tampering
// ============================================================================

// Private listed first — it's the priority package (whole-venue exclusive,
// higher revenue per slot). Render order on /book + /parties follows
// Object.keys order, which preserves insertion order in JS objects.
export const PACKAGES = {
  private: {
    id: 'private',
    name: 'Private',
    priceCents: 125000,
    includedKids: 16,
    extraKidPriceCents: 2500,
    durationMinutes: 120,
    description: 'The entire venue is yours. We close to the public for your party.',
    includes: [
      '15 children + the birthday child included',
      '$25 per extra child (up to 40 total)',
      'Entire venue, exclusive use',
      'We close to the public for your party',
      'Dedicated host + helper',
      'Setup and cleanup',
    ],
  },
  semi: {
    id: 'semi',
    name: 'Semi-Private',
    priceCents: 65000,
    // Headcount: 10 kids + the birthday child are included.
    // Each additional kid is $25. Hard cap at MAX_KIDS_PER_PARTY.
    includedKids: 11,
    extraKidPriceCents: 2500,
    durationMinutes: 120,
    description: 'Your party gets the dedicated party room. Open play continues in the rest of the venue.',
    includes: [
      '10 children + the birthday child included',
      '$25 per extra child (up to 40 total)',
      '2 hours in the dedicated party room',
      'Dedicated party host',
      'Setup & cleanup',
    ],
  },
} as const;

// Hard ceiling across all packages
const MAX_KIDS_PER_PARTY = 40;

// 1-hour extension is the only option now. Price differs by package:
// $500 private, $250 semi-private — looked up via getExtensionPriceCents()
export const EXTENSIONS = {
  '60m': { id: '60m', label: '1 hour', minutes: 60, priceCents: 50000 },
} as const;

export function getExtensionPriceCents(
  packageId: PackageId,
  extensionId: ExtensionId | null,
): number {
  if (!extensionId) return 0;
  return packageId === 'private' ? 50000 : 25000;
}

// Time slots are different by package:
// - Private: every hour 10am–6pm. Each booking blocks its 2-hour window
//   plus a 30-minute buffer (setup/cleanup) — see partyTimeConflict() in
//   lib/parties.ts. Multiple Private parties can run on the same day as
//   long as their buffered windows don't overlap.
// - Semi-Private: two slot options — 1–3pm or 2–4pm. Only one runs per day.
export const PRIVATE_PARTY_TIMES = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
] as const;
export const SEMI_PARTY_TIMES = ['1:00 PM', '2:00 PM'] as const;

export function partyTimesFor(packageId: PackageId): readonly string[] {
  return packageId === 'private' ? PRIVATE_PARTY_TIMES : SEMI_PARTY_TIMES;
}

// 20% off all private parties booked Mon–Thu (any time slot).
const DISCOUNT_RATE = 0.2;

// NYC sales tax
const TAX_RATE = 0.08875;

// Open play
export const OPEN_PLAY_PRICE_CENTS = 2500;

export type PackageId = keyof typeof PACKAGES;
export type ExtensionId = keyof typeof EXTENSIONS;

export interface PartyPricingInput {
  packageId: PackageId;
  date: Date;
  time: string;
  extensionId?: ExtensionId | null;
  // Total kids (including the birthday child). Defaults to the package's
  // included headcount if omitted. Each kid above included gets charged
  // extraKidPriceCents.
  headcount?: number;
}

export interface PartyPricing {
  baseCents: number;
  extensionCents: number;
  extraKidCount: number;
  extraKidCents: number;
  discountCents: number;
  discountApplied: boolean;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
}

/**
 * The 20% Mon–Thu discount rule.
 * Applies to any Private party booked Mon–Thu (any time slot).
 */
export function isWeekdayAfternoonDiscount(input: PartyPricingInput): boolean {
  if (input.packageId !== 'private') return false;
  const day = input.date.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 6=Sat
  return day >= 1 && day <= 4;
}

export function calculatePartyPricing(input: PartyPricingInput): PartyPricing {
  const pkg = PACKAGES[input.packageId];

  const baseCents = pkg.priceCents;
  const extensionCents = getExtensionPriceCents(input.packageId, input.extensionId ?? null);

  // Extra-kid surcharge — only beyond included headcount, capped at MAX_KIDS_PER_PARTY
  const requestedHeadcount = Math.min(
    Math.max(input.headcount ?? pkg.includedKids, 1),
    MAX_KIDS_PER_PARTY,
  );
  const extraKidCount = Math.max(0, requestedHeadcount - pkg.includedKids);
  const extraKidCents = extraKidCount * pkg.extraKidPriceCents;

  const preDiscountCents = baseCents + extensionCents + extraKidCents;

  const discountApplied = isWeekdayAfternoonDiscount(input);
  const discountCents = discountApplied ? Math.round(preDiscountCents * DISCOUNT_RATE) : 0;

  const subtotalCents = preDiscountCents - discountCents;
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;
  const depositCents = Math.round(totalCents / 2);

  return {
    baseCents,
    extensionCents,
    extraKidCount,
    extraKidCents,
    discountCents,
    discountApplied,
    subtotalCents,
    taxCents,
    totalCents,
    depositCents,
  };
}

export type PartyPortionLine = { label: string; cents: number };

/**
 * Itemizes the party portion (parties.subtotal_cents) into base + extra-kid
 * (+ time extension, − Mon–Thu discount) lines, all derived from headcount —
 * the single source of truth for extra-kid pricing. Shared by the Stripe
 * invoice, the confirmation + balance-updated emails, and the calendar event
 * so they all show the flat base fee and extra kids as separate lines.
 *
 * Returns a single combined line if the recomputed parts don't reconcile
 * exactly with storedSubtotalCents (legacy rows / custom pricing), so no
 * downstream total can ever drift from the stored figure.
 */
export function partyPortionLines(input: {
  packageId: PackageId;
  date: Date;
  time: string;
  extensionMinutes?: number | null;
  headcount?: number | null;
  storedSubtotalCents: number;
}): PartyPortionLine[] {
  const pkg = PACKAGES[input.packageId];
  const single: PartyPortionLine[] = [
    { label: `${pkg.name} party`, cents: input.storedSubtotalCents },
  ];
  try {
    const extensionId: ExtensionId | null =
      (input.extensionMinutes ?? 0) >= 60 ? ('60m' as ExtensionId) : null;
    const b = calculatePartyPricing({
      packageId: input.packageId,
      date: input.date,
      time: input.time,
      extensionId,
      headcount: input.headcount ?? undefined,
    });
    // Only itemize if the parts add back up to the stored subtotal.
    if (b.subtotalCents !== input.storedSubtotalCents) return single;

    const lines: PartyPortionLine[] = [{ label: `${pkg.name} party`, cents: b.baseCents }];
    if (b.extraKidCount > 0) {
      lines.push({ label: `Extra kid over package × ${b.extraKidCount}`, cents: b.extraKidCents });
    }
    if (b.extensionCents > 0) {
      lines.push({ label: `Time extension (+${input.extensionMinutes} min)`, cents: b.extensionCents });
    }
    if (b.discountCents > 0) {
      lines.push({ label: 'Mon–Thu 20% discount', cents: -b.discountCents });
    }
    return lines;
  } catch {
    return single;
  }
}

export function calculateOpenPlayPricing(numKids: number) {
  const totalCents = numKids * OPEN_PLAY_PRICE_CENTS;
  return { totalCents, perKidCents: OPEN_PLAY_PRICE_CENTS };
}

// Format helpers for display
export const fmt = (cents: number) => `$${(cents / 100).toFixed(0)}`;
