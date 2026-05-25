import Image from 'next/image';
import Link from 'next/link';
import { MobileNav } from '@/components/MobileNav';

const navItems = [
  { href: '/parties', label: 'Parties' },
  { href: '/memberships', label: 'Memberships' },
  { href: '/gift-cards', label: 'Gift Cards' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
];

export function AnnouncementBar() {
  return (
    <div className="bg-coral text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-semibold">
        <span aria-hidden>🎉</span>
        <span>
          Limited-time offer: 20% off private parties Mon–Thu
        </span>
        <Link
          href="/parties"
          className="ml-2 hidden rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold hover:bg-white/30 sm:inline-flex"
        >
          Book now →
        </Link>
      </div>
    </div>
  );
}

export function Header() {
  return (
    <header className="border-b border-slate-100 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Wonderland Playhouse"
            width={566}
            height={395}
            priority
            className="h-16 w-auto md:h-24"
            style={{ mixBlendMode: 'multiply' }}
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-coral">
              {item.label}
            </Link>
          ))}
          <Link
            href="/parties"
            className="rounded-full bg-coral px-5 py-2.5 text-white shadow-playful transition hover:bg-coral-600"
          >
            Book a Party
          </Link>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/parties"
            className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white shadow-playful"
          >
            Book
          </Link>
          <MobileNav items={navItems} />
        </div>
      </div>

      {/* Mobile/tablet horizontal tab bar — always-visible nav so users don't have to hunt for the hamburger */}
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-full px-3 py-1.5 transition hover:bg-cream-deep hover:text-coral"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
