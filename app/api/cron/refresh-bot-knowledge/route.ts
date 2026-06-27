// ============================================================================
// Daily bot-knowledge refresh  (Railway cron, 2am America/New_York)
//
// Scans the public website, strips each page to text, and stores a bounded
// snapshot in the bot_knowledge table. The website chat + SMS auto-responder
// read that snapshot (lib/bot-knowledge.ts) so any copy/page changes flow into
// the bot automatically — no redeploy needed.
//
// Pricing is NOT taken from the scan: the bot derives authoritative prices live
// from lib/pricing.ts. This scan is for prose/details (descriptions, policies,
// new pages) that aren't expressed as code constants.
//
// Schedule on Railway (cron service):
//   URL:    https://<domain>/api/cron/refresh-bot-knowledge
//   Method: GET
//   Header: x-cron-secret: <CRON_SECRET>
//   When:   Every day at 02:00 America/New_York
// ============================================================================

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { clearSnapshotCache } from '@/lib/bot-knowledge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Content-rich, mostly-static public pages worth scanning. Interactive booking
// flows are skipped — their facts live in the pricing engine, not page copy.
const PAGES = ['/', '/parties', '/memberships', '/gift-cards', '/about'];

// Keep the snapshot bounded so it never bloats the system prompt.
const MAX_CHARS_PER_PAGE = 2500;
const MAX_TOTAL_CHARS = 9000;

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

// Strip an HTML document down to readable text.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const base = (
    process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  ).replace(/\/$/, '');

  const pageMeta: { path: string; chars: number; ok: boolean }[] = [];
  const sections: string[] = [];
  let total = 0;

  for (const path of PAGES) {
    if (total >= MAX_TOTAL_CHARS) {
      pageMeta.push({ path, chars: 0, ok: false });
      continue;
    }
    try {
      const res = await fetch(base + path, {
        cache: 'no-store',
        headers: { 'user-agent': 'WonderlandBotKnowledge/1.0' },
      });
      if (!res.ok) {
        pageMeta.push({ path, chars: 0, ok: false });
        continue;
      }
      const text = htmlToText(await res.text()).slice(0, MAX_CHARS_PER_PAGE);
      const room = Math.max(0, MAX_TOTAL_CHARS - total);
      const clipped = text.slice(0, room);
      if (clipped) {
        sections.push(`## Page: ${path}\n${clipped}`);
        total += clipped.length;
      }
      pageMeta.push({ path, chars: clipped.length, ok: true });
    } catch (err) {
      console.warn(`[bot-knowledge] failed to scan ${path}:`, err);
      pageMeta.push({ path, chars: 0, ok: false });
    }
  }

  const content = sections.join('\n\n');
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  // Did the site actually change since the last scan?
  let changed = true;
  try {
    const { data: prev } = await supabaseAdmin()
      .from('bot_knowledge')
      .select('hash')
      .eq('id', 1)
      .maybeSingle();
    changed = prev?.hash !== hash;
  } catch {
    // ignore — treat as changed
  }

  try {
    const { error } = await supabaseAdmin()
      .from('bot_knowledge')
      .upsert(
        {
          id: 1,
          content,
          hash,
          pages: pageMeta,
          scanned_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    if (error) throw error;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'write failed';
    console.error('[bot-knowledge] upsert failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  clearSnapshotCache();
  const scanned = pageMeta.filter((p) => p.ok).length;
  console.log(
    `[bot-knowledge] scanned ${scanned}/${PAGES.length} pages, ${content.length} chars, changed=${changed}`,
  );
  return NextResponse.json({
    ok: true,
    changed,
    pagesScanned: scanned,
    totalPages: PAGES.length,
    chars: content.length,
    pages: pageMeta,
  });
}
