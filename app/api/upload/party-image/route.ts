// Public-facing image upload used during /book. Customers can upload up to
// 3 inspiration photos (cake design, decor theme, etc) before payment.
//
// Server-side upload via service-role key — the client never touches Supabase
// directly, so we can throttle and validate type/size cleanly.
//
// Stored in the 'party-inspiration' bucket. The bucket must be created in
// Supabase dashboard with public read; this route writes via service role.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB per image
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Only JPG/PNG/WebP/HEIC images' }, { status: 415 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const safeExt = ext.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = `pending/${crypto.randomUUID()}.${safeExt}`;

  const supabase = supabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('party-inspiration')
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (upErr) {
    console.error('Storage upload failed:', upErr);
    return NextResponse.json(
      { error: 'Upload failed', detail: upErr.message },
      { status: 500 },
    );
  }

  const { data: pub } = supabase.storage.from('party-inspiration').getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, path });
}
