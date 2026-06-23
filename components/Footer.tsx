import Image from 'next/image';
import Link from 'next/link';

const MAPS_EMBED_URL =
  'https://www.google.com/maps?q=Wonderland+Playhouse,+3830+Nostrand+Ave,+Brooklyn,+NY+11235&output=embed';
const MAPS_DIRECTIONS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=Wonderland+Playhouse,+3830+Nostrand+Ave,+Brooklyn,+NY+11235';
const INSTAGRAM_URL = 'https://www.instagram.com/wonderlandplayhouseny';

export function Footer() {
  return (
    <footer className="bg-slate-700 py-14 text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Image
            src="/logo.jpg"
            alt="Wonderland Playhouse"
            width={566}
            height={395}
            className="h-auto w-[200px] opacity-95 md:w-[240px]"
          />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/80">
            A magical, low-stim birthday venue and play space in Brooklyn for
            kids 0–8. Curated, calm, designed for the photos.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Wonderland Playhouse on Instagram"
              className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-4 py-2 text-xs font-semibold text-cream/90 transition hover:border-sunshine hover:text-sunshine"
            >
              <InstagramIcon className="h-4 w-4" />
              @wonderlandplayhouseny
            </a>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-sunshine">Visit</p>
          <p className="text-sm leading-relaxed text-cream/90">
            3830 Nostrand Ave
            <br />
            Brooklyn, NY 11235
          </p>
          <p className="mt-2 text-sm">
            <a href="tel:+17188891777" className="hover:text-sunshine">
              (718) 889-1777
            </a>
          </p>
          <p className="text-sm">
            <a href="mailto:info@wonderlandplayhouse.com" className="hover:text-sunshine">
              info@wonderlandplayhouse.com
            </a>
          </p>
          <a
            href={MAPS_DIRECTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs font-bold uppercase tracking-wider text-sunshine hover:text-cream"
          >
            Get directions →
          </a>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-sunshine">Explore</p>
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/parties" className="hover:text-sunshine">Parties</Link></li>
            <li><Link href="/memberships" className="hover:text-sunshine">Memberships</Link></li>
            <li><Link href="/gift-cards" className="hover:text-sunshine">Gift Cards</Link></li>
            <li><Link href="/about" className="hover:text-sunshine">About</Link></li>
            <li><Link href="/blog" className="hover:text-sunshine">Blog</Link></li>
            <li><Link href="/waiver" className="hover:text-sunshine">Waiver</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl px-6">
        <div className="overflow-hidden rounded-2xl border border-cream/10 shadow-card">
          <iframe
            src={MAPS_EMBED_URL}
            title="Wonderland Playhouse on Google Maps"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-56 w-full border-0"
          />
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-6xl border-t border-cream/15 px-6 pt-6 flex flex-col items-start justify-between gap-2 text-xs text-cream/60 sm:flex-row">
        <p>© {new Date().getFullYear()} Wonderland Playhouse · Brooklyn, NY</p>
        <Link href="/admin" className="text-cream/40 transition hover:text-sunshine">
          Staff →
        </Link>
      </div>
    </footer>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
