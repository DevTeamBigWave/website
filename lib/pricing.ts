// ============================================================================
// Pricing — single source of truth for all party math
// Used by: client booking UI (display) AND server checkout endpoint (authoritative)
// Server always re-runs these calcs from raw inputs to prevent client tampering
// ============================================================================

export const PACKAGES = {
  semi: {
    id: 'semi',
    name: 'Semi-Private',
    priceCents: 65000,
    // Headcount: 10 kids + the birthday child are included.
    // Each additional kid is $25. Hard cap at MAX_KIDS_PER_PARTY.
    includedKids: 11,
    extraKidPriceCents: 2500,
    durationMinutes: 120,
    description: 'Your party, plus a few other families in the space.',
    includes: [
      '10 children + the birthday child included',
      '$25 per extra child (up to 40 total)',
      '2 hours of play',
      'Dedicated party host',
      'Setup & cleanup',
    ],
  },
  private: {
    id: 'private',
    name: 'Private',
    priceCents: 125000,
    includedKids: 16,
    extraKidPriceCents: 2500,
    durationMinutes: 120,
    description: 'The whole magical venue. Just you. Closes the space.',
    includes: [
      '15 children + the birthday child included',
      '$25 per extra child (up to 40 total)',
      '2 hours, exclusive use',
      'Dedicated host + helper',
      'Setup and cleanup',
    ],
  },
} as const;

// Hard ceiling across all packages
export const MAX_KIDS_PER_PARTY = 40;

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
// - Private: any 2-hour window between 10am and 8pm — these are the standard
//   slots, but anything is negotiable (parents should call for off-slot times)
// - Semi-Private: only two set slots (1-3pm or 2-4pm)
export const PRIVATE_PARTY_TIMES = [
  '10:00 AM',
  '12:00 PM',
  '2:00 PM',
  '4:00 PM',
  '6:00 PM',
] as const;
export const SEMI_PARTY_TIMES = ['1:00 PM', '2:00 PM'] as const;

// Legacy compat — defaults to private slot list
export const PARTY_TIMES = PRIVATE_PARTY_TIMES;

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

export function calculateOpenPlayPricing(numKids: number) {
  const totalCents = numKids * OPEN_PLAY_PRICE_CENTS;
  return { totalCents, perKidCents: OPEN_PLAY_PRICE_CENTS };
}

// Format helpers for display
export const fmt = (cents: number) => `$${(cents / 100).toFixed(0)}`;
