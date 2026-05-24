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
    maxKids: 15,
    durationMinutes: 120,
    description: 'Your party, plus a few other families in the space.',
    includes: [
      'Up to 15 children',
      '2 hours of play',
      'Dedicated party host',
      'Setup & cleanup',
    ],
  },
  private: {
    id: 'private',
    name: 'Private',
    priceCents: 125000,
    maxKids: 25,
    durationMinutes: 120,
    description: 'The whole magical venue. Just you. Closes the space.',
    includes: [
      'Up to 25 children',
      '2 hours, exclusive use',
      'Dedicated host + helper',
      'Setup and cleanup',
    ],
  },
} as const;

export const EXTENSIONS = {
  '30m': { id: '30m', label: '30 minutes', minutes: 30, priceCents: 15000 },
  '60m': { id: '60m', label: '1 hour', minutes: 60, priceCents: 27500 },
} as const;

export const PARTY_TIMES = ['10:00 AM', '12:00 PM', '2:00 PM', '5:00 PM'] as const;

// 20% off Mon–Thu afternoons. The two qualifying time slots:
const DISCOUNT_TIMES = ['12:00 PM', '2:00 PM'] as const;
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
}

export interface PartyPricing {
  baseCents: number;
  extensionCents: number;
  discountCents: number;
  discountApplied: boolean;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
}

/**
 * The 20% Mon–Thu afternoon discount rule.
 * Only applies to Private package on Mon-Thu at 12pm or 2pm.
 */
export function isWeekdayAfternoonDiscount(input: PartyPricingInput): boolean {
  if (input.packageId !== 'private') return false;
  const day = input.date.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 6=Sat
  const isMonThu = day >= 1 && day <= 4;
  const isAfternoonSlot = (DISCOUNT_TIMES as readonly string[]).includes(input.time);
  return isMonThu && isAfternoonSlot;
}

export function calculatePartyPricing(input: PartyPricingInput): PartyPricing {
  const pkg = PACKAGES[input.packageId];
  const ext = input.extensionId ? EXTENSIONS[input.extensionId] : null;

  const baseCents = pkg.priceCents;
  const extensionCents = ext?.priceCents ?? 0;
  const preDiscountCents = baseCents + extensionCents;

  const discountApplied = isWeekdayAfternoonDiscount(input);
  const discountCents = discountApplied ? Math.round(preDiscountCents * DISCOUNT_RATE) : 0;

  const subtotalCents = preDiscountCents - discountCents;
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;
  const depositCents = Math.round(totalCents / 2);

  return {
    baseCents,
    extensionCents,
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
