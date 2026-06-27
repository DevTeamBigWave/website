import type Anthropic from '@anthropic-ai/sdk';
import {
  calculatePartyPricing,
  PACKAGES,
  fmt,
  type PackageId,
} from '@/lib/pricing';

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description:
      "Check whether specific dates are available for parties or open play at Wonderland Playhouse. Returns the list of blocked dates in the requested window so you can confirm whether a date the user asked about is open or closed.",
    input_schema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description:
            "Start date in YYYY-MM-DD format (e.g. '2026-03-15'). Defaults to today if omitted.",
        },
        days: {
          type: 'integer',
          description:
            'How many days of availability to fetch starting from `from`. Defaults to 14. Max 90.',
          minimum: 1,
          maximum: 90,
        },
      },
    },
  },
  {
    name: 'quote_party_price',
    description:
      "Compute the EXACT price of a party using the venue's official pricing engine — the same math the checkout charges. Use this whenever a parent asks what a party costs with any specifics: a headcount above the included kids, a number of adults, the 1-hour extension, or a particular date (for the Mon–Thu 20% Private discount). Returns an itemized breakdown plus subtotal, tax, total, and the 50% deposit. ALWAYS prefer this over doing the math yourself. Add-on prices (cake, decor, entertainment, etc.) are NOT included here — quote those from your instructions and tell the parent add-ons are finalized on the planning call.",
    input_schema: {
      type: 'object',
      properties: {
        package: {
          type: 'string',
          enum: ['private', 'semi'],
          description:
            "Which package: 'private' (whole venue, $1,250 base, 16 kids incl.) or 'semi' (party room, $650 base, 11 kids incl.).",
        },
        headcount: {
          type: 'integer',
          description:
            'Total number of CHILDREN including the birthday child. Omit to use the package default (Private 16, Semi 11). Each kid over the included count is $25. Hard cap 40.',
          minimum: 1,
          maximum: 40,
        },
        adultCount: {
          type: 'integer',
          description:
            'Total number of ADULTS attending. Each kid includes 2 free adults; extras are $10 each. Omit if the parent did not give an adult count (no extra-adult charge will be added).',
          minimum: 0,
        },
        extension: {
          type: 'boolean',
          description:
            'true if they want the 1-hour extension ($500 Private / $250 Semi). Omit or false otherwise.',
        },
        date: {
          type: 'string',
          description:
            "Party date in YYYY-MM-DD format. Provide it whenever known — a Private party on Mon–Thu gets 20% off automatically. Omit if no date is specified (no discount will be applied and the result notes the Mon–Thu offer).",
        },
      },
      required: ['package'],
    },
  },
];

type AvailabilityRow = {
  date: string;
  blockType: 'full' | 'partial';
  reason: string;
  package?: string;
  startTime?: string;
};

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  baseUrl: string,
): Promise<string> {
  if (name === 'quote_party_price') {
    return quotePartyPrice(input);
  }

  if (name !== 'check_availability') {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  const from = typeof input.from === 'string' ? input.from : undefined;
  const days = typeof input.days === 'number' ? input.days : 14;

  const url = new URL('/api/availability', baseUrl);
  if (from) url.searchParams.set('from', from);
  url.searchParams.set('days', String(days));

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      return JSON.stringify({
        error: `Availability check failed with status ${res.status}`,
      });
    }
    const data = (await res.json()) as {
      availability: AvailabilityRow[];
      from: string;
      to: string;
    };

    return JSON.stringify({
      from: data.from.split('T')[0],
      to: data.to.split('T')[0],
      blocked_dates: data.availability.map((row) => ({
        date: row.date,
        block_type: row.blockType,
        reason: row.reason,
      })),
      note:
        data.availability.length === 0
          ? 'No bookings in this window — all dates are open.'
          : "Dates listed are NOT available. Any date in the window not in the list IS available.",
    });
  } catch (err: unknown) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

// Compute an exact party quote from the official pricing engine (lib/pricing.ts)
// so chat + SMS never hand-calculate a price that could drift from checkout.
function quotePartyPrice(input: Record<string, unknown>): string {
  const packageId = input.package === 'semi' ? 'semi' : input.package === 'private' ? 'private' : null;
  if (!packageId) {
    return JSON.stringify({ error: "package must be 'private' or 'semi'." });
  }
  const pkg = PACKAGES[packageId as PackageId];

  const headcount =
    typeof input.headcount === 'number' ? input.headcount : undefined;
  const adultCount =
    typeof input.adultCount === 'number' ? input.adultCount : undefined;
  const extension = input.extension === true;

  // Parse the date as a LOCAL calendar day so getDay() (used for the Mon–Thu
  // Private discount) reflects the date the parent meant, not a UTC shift.
  let date: Date;
  let dateKnown = false;
  if (typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    const [y, m, d] = input.date.split('-').map(Number);
    date = new Date(y, m - 1, d);
    dateKnown = !Number.isNaN(date.getTime());
  } else {
    // No date given → use a Saturday so no discount is applied to the quote.
    date = new Date(2026, 0, 3); // a Saturday
  }

  const p = calculatePartyPricing({
    packageId: packageId as PackageId,
    date,
    time: '12:00 PM', // not used by the math, only the date matters
    extensionId: extension ? '60m' : null,
    headcount,
    adultCount,
  });

  const lines: { label: string; amount: string }[] = [
    { label: `${pkg.name} base`, amount: fmt(p.baseCents) },
  ];
  if (p.extraKidCount > 0) {
    lines.push({
      label: `Extra kids × ${p.extraKidCount} ($25 ea)`,
      amount: fmt(p.extraKidCents),
    });
  }
  if (p.extraAdultCount > 0) {
    lines.push({
      label: `Extra adults × ${p.extraAdultCount} ($10 ea)`,
      amount: fmt(p.extraAdultCents),
    });
  }
  if (p.extensionCents > 0) {
    lines.push({ label: '1-hour extension', amount: fmt(p.extensionCents) });
  }
  if (p.discountApplied) {
    lines.push({ label: 'Mon–Thu 20% off (Private)', amount: `-${fmt(p.discountCents)}` });
  }

  return JSON.stringify({
    package: pkg.name,
    included_kids: pkg.includedKids,
    included_adults: p.includedAdults,
    line_items: lines,
    subtotal: fmt(p.subtotalCents),
    tax: `${fmt(p.taxCents)} (8.875% NYC sales tax)`,
    total: fmt(p.totalCents),
    deposit_due_now: `${fmt(p.depositCents)} (50% deposit; balance due 7 days before)`,
    discount_applied: p.discountApplied,
    notes: [
      !dateKnown && packageId === 'private'
        ? 'No date given, so the Mon–Thu 20% Private discount is NOT in this quote. If their date is a Mon–Thu, it would be 20% less.'
        : null,
      'Add-ons (cake, decor, entertainment, extra food) are not in this quote and are finalized on the planning call.',
      'All prices include + tax as shown. Deposit is 50% of the total.',
    ].filter(Boolean),
  });
}
