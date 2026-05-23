import Image from 'next/image';
import Link from 'next/link';

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
            className="h-14 w-auto opacity-95"
          />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/80">
            Brooklyn&rsquo;s private play space for kids 0–8. Birthday parties,
            open play, and a soft place to land.
          </p>
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
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-sunshine">Explore</p>
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/parties" className="hover:text-sunshine">Parties</Link></li>
            <li><Link href="/memberships" className="hover:text-sunshine">Memberships</Link></li>
            <li><Link href="/gift-cards" className="hover:text-sunshine">Gift Cards</Link></li>
            <li><Link href="/about" className="hover:text-sunshine">About</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-cream/15 px-6 pt-6 flex flex-col items-start justify-between gap-2 text-xs text-cream/60 sm:flex-row">
        <p>© {new Date().getFullYear()} Wonderland Playhouse · Brooklyn, NY</p>
        <Link href="/admin" className="text-cream/40 transition hover:text-sunshine">
          Staff →
        </Link>
      </div>
    </footer>
  );
}
