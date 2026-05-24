import { NextResponse } from 'next/server';
import { getGiftCardByCode, balanceCents } from '@/lib/gift-cards';

export const dynamic = 'force-dynamic';

// GET /api/gift-cards/validate?code=WP-XXXX-XXXX
// Returns { valid: true, balanceCents } or { valid: false, error }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ valid: false, error: 'Code required' }, { status: 400 });
  }

  const card = await getGiftCardByCode(code);
  if (!card) {
    return NextResponse.json({ valid: false, error: 'Invalid code' }, { status: 404 });
  }
  if (card.status !== 'active') {
    return NextResponse.json(
      { valid: false, error: card.status === 'redeemed' ? 'This card has been fully used' : 'Card not active' },
      { status: 409 },
    );
  }

  const balance = balanceCents(card);
  if (balance <= 0) {
    return NextResponse.json({ valid: false, error: 'No balance remaining' }, { status: 409 });
  }

  return NextResponse.json({
    valid: true,
    code: card.code,
    balanceCents: balance,
  });
}
