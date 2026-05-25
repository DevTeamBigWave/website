import Link from 'next/link';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://website-production-4594.up.railway.app';

const KIOSK_URL = `${SITE}/waiver?kiosk=1`;

export default async function WaiverKioskPage() {
  const qrSvgRaw = await QRCode.toString(KIOSK_URL, {
    type: 'svg',
    margin: 1,
    color: { dark: '#2C4253', light: '#FFFBF5' },
    errorCorrectionLevel: 'H',
  });
  // Make the SVG fully responsive — strip fixed width/height
  const qrSvg = qrSvgRaw
    .replace(/\swidth="[^"]+"/, ' width="100%"')
    .replace(/\sheight="[^"]+"/, ' height="100%"');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Front-desk waiver QR</h1>
        <p className="mt-1 text-sm text-slate-500">
          Print this or screenshot it. Stick at the door / front desk. Customers scan and
          sign on their own phone — no staff needed.
        </p>
      </header>

      {/* The printable card */}
      <div className="printable mx-auto max-w-md rounded-3xl bg-white p-8 shadow-card print:shadow-none">
        <p className="text-center text-xs font-bold uppercase tracking-wider text-coral">
          Wonderland Playhouse
        </p>
        <h2 className="mt-1 text-center font-display text-3xl text-slate-700">
          Sign the waiver
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Once per year covers every visit — open play, parties, guest kids
        </p>

        <div
          className="mx-auto mt-6 aspect-square w-full max-w-sm"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <p className="mt-4 text-center font-mono text-xs text-slate-400 break-all">
          {KIOSK_URL.replace(/^https?:\/\//, '')}
        </p>
      </div>

      <div className="no-print grid gap-3 sm:grid-cols-2">
        <Link
          href={KIOSK_URL}
          target="_blank"
          rel="noopener"
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-coral hover:shadow-card"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-coral">
            Open kiosk in browser
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Use on a tablet at the front desk. After each signature it auto-resets for
            the next family.
          </p>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-coral">
            How to print
          </p>
          <p className="mt-1 text-sm text-slate-600">
            From this page → browser menu → Print. Everything except the card above is
            hidden when printing.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print, header, nav, footer { display: none !important; }
          .printable { box-shadow: none !important; max-width: none !important; }
        }
      `}</style>

      <div className="rounded-2xl border border-sunshine-200 bg-sunshine-50 p-4 text-sm text-slate-700">
        <p className="font-bold">Suggested in-store setup</p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li><strong>QR sticker at the door:</strong> customers scan with their own phone on the way in</li>
          <li><strong>Tablet at the desk:</strong> open the kiosk URL in fullscreen; tap "Next family →" after each customer</li>
          <li><strong>When paying on Clover:</strong> staff confirms the waiver email matches the customer's email — saves the customer from re-signing on every visit</li>
        </ul>
      </div>
    </div>
  );
}
