import type Anthropic from '@anthropic-ai/sdk';

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
