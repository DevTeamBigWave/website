import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Site-wide default Open Graph / social share image (1200x630). Next.js applies
// this to every route that doesn't define its own, so links to the site (texts,
// social, search) show a properly branded card: the real logo on the brand
// gradient with playful shapes. Most platforms (incl. iMessage/X) fall back to
// og:image, so this also serves the Twitter card.
//
// Node runtime so we can embed the logo straight from /public (no network dep).
export const runtime = 'nodejs';
export const alt =
  'Wonderland Playhouse — a magical, low-stim birthday venue and indoor play space in Brooklyn for kids 0–8';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand palette (from tailwind.config.ts)
const CORAL = '#ff7783';
const CORAL_DARK = '#B43E47';
const SUNSHINE = '#fdda26';
const SKY = '#89cff0';
const SLATE = '#2C4253';

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), 'public/logo.jpg'));
  const logoSrc = `data:image/jpeg;base64,${logo.toString('base64')}`;

  const pills = ['Private & Semi-Private Parties', 'Open Play', 'Memberships'];

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background:
            'linear-gradient(135deg, #FFE0E4 0%, #FFFBF5 50%, #FFF6BF 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Playful brand shapes */}
        <div
          style={{
            position: 'absolute',
            top: -110,
            left: -90,
            width: 320,
            height: 320,
            borderRadius: 9999,
            background: 'rgba(255,119,131,0.20)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            right: -70,
            width: 300,
            height: 300,
            borderRadius: 9999,
            background: 'rgba(253,218,38,0.28)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 70,
            right: 120,
            width: 90,
            height: 90,
            borderRadius: 9999,
            background: 'rgba(137,207,240,0.45)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 90,
            left: 130,
            width: 60,
            height: 60,
            borderRadius: 9999,
            background: 'rgba(137,207,240,0.40)',
          }}
        />

        {/* White brand card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#FFFFFF',
            borderRadius: 40,
            padding: '44px 60px',
            boxShadow: '0 24px 60px -16px rgba(80,117,143,0.30)',
            maxWidth: 1000,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={470} height={328} style={{ objectFit: 'contain' }} alt="" />

          <div
            style={{
              marginTop: 12,
              fontSize: 34,
              fontWeight: 600,
              color: SLATE,
              textAlign: 'center',
              maxWidth: 820,
              lineHeight: 1.25,
            }}
          >
            A magical, low-stim birthday venue &amp; indoor play space — designed
            for calm.
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 28 }}>
            {pills.map((p, i) => (
              <div
                key={p}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 20px',
                  borderRadius: 9999,
                  fontSize: 22,
                  fontWeight: 700,
                  color: i === 0 ? '#FFFFFF' : SLATE,
                  background:
                    i === 0 ? CORAL : i === 1 ? 'rgba(137,207,240,0.30)' : 'rgba(253,218,38,0.35)',
                }}
              >
                {p}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 26,
              fontSize: 24,
              fontWeight: 700,
              color: CORAL_DARK,
              letterSpacing: 1,
            }}
          >
            Brooklyn, NY · wonderlandplayhouse.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
