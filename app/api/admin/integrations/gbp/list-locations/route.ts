import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin';
import { listAccounts, listLocations } from '@/lib/gbp';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireOwner();

  try {
    const accounts = await listAccounts();
    const result: Array<{
      accountName: string;
      accountResourceName: string;
      locations: Array<{ name: string; title: string; addressLine?: string }>;
    }> = [];

    for (const a of accounts) {
      const locations = await listLocations(a.name);
      result.push({
        accountName: a.accountName,
        accountResourceName: a.name,
        locations: locations.map((l) => ({
          name: l.name,
          title: l.title,
          addressLine: l.storefrontAddress?.addressLines?.[0],
        })),
      });
    }

    return NextResponse.json({ ok: true, accounts: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
