import { ImageResponse } from 'next/og';

// Site-wide default Open Graph / social share image (1200x630). Next.js applies
// this to every route that doesn't define its own. Generated at build/request
// time so there's no binary asset to maintain. Most platforms (incl. X/Twitter)
// fall back to og:image, so this also serves the Twitter card.
export const runtime = 'edge';
export const alt =
  'Wonderland Playhouse — a magical, low-stim birthday venue and indoor play space in Brooklyn for kids 0–8';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #FFFBF5 0%, #FFE9E2 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#FF6B5E',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: '#FF6B5E',
            }}
          />
          Brooklyn · Kids 0–8
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            color: '#2C4253',
            maxWidth: 980,
          }}
        >
          Wonderland Playhouse
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 38,
            lineHeight: 1.25,
            color: '#5A6B78',
            maxWidth: 900,
          }}
        >
          A magical, low-stim birthday venue &amp; indoor play space — designed
          for calm.
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            gap: 40,
            fontSize: 26,
            fontWeight: 600,
            color: '#2C4253',
          }}
        >
          <span>Private &amp; semi-private parties</span>
          <span style={{ color: '#FF6B5E' }}>·</span>
          <span>Open play</span>
          <span style={{ color: '#FF6B5E' }}>·</span>
          <span>Memberships</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
