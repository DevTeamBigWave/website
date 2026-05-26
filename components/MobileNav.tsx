'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

type NavItem = { href: string; label: string };

const BOOK_ACTIONS: Array<{ href: string; label: string; sub: string; emoji: string }> = [
  { href: '/book', label: 'Book a Party', sub: 'Semi-private or private', emoji: '🎉' },
  { href: '/book/open-play', label: 'Book Open Play', sub: '$25/kid · 12–7:30pm daily', emoji: '🎈' },
  { href: '/tour', label: 'Free Tour', sub: '30-min in-person walkthrough', emoji: '👀' },
  { href: '/inquire', label: 'Book a Call', sub: '20-min, talk it through', emoji: '📞' },
  { href: '/waiver', label: 'Sign Waiver', sub: 'Once a year covers every visit', emoji: '📝' },
];

const PAGES: Array<{ href: string; label: string }> = [
  { href: '/parties', label: 'Parties' },
  { href: '/memberships', label: 'Memberships' },
  { href: '/gift-cards', label: 'Gift Cards' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
];

const INSTAGRAM_URL = 'https://www.instagram.com/wonderlandplayhouseny';
const DIRECTIONS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=Wonderland+Playhouse,+3830+Nostrand+Ave,+Brooklyn,+NY+11235';

export function MobileNav({ items: _items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-coral hover:text-coral lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-cream lg:hidden">
          {/* Fixed header — never scrolls */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-cream px-6 pt-5 pb-3">
            <p className="font-display text-lg text-slate-700">Menu</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-coral hover:text-coral"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable content — fills remaining space */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-4"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
          >

            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">Book</p>
            <div className="grid grid-cols-2 gap-2">
              {BOOK_ACTIONS.map((b) => (
                <Link
                  key={b.href}
                  href={b.href}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-coral hover:shadow-card"
                >
                  <span className="text-lg" aria-hidden>{b.emoji}</span>
                  <span className="mt-1 text-sm font-bold text-slate-700">{b.label}</span>
                  <span className="text-xs text-slate-400">{b.sub}</span>
                </Link>
              ))}
            </div>

            <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-coral">Explore</p>
            <nav className="flex flex-col gap-0.5">
              {PAGES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2.5 text-base font-semibold text-slate-700 transition hover:bg-white hover:text-coral"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-wider text-coral">Visit + reach us</p>
            <div className="space-y-1.5 text-sm text-slate-600">
              <p>3830 Nostrand Ave, Brooklyn NY 11235</p>
              <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className="block text-coral hover:text-coral-700">
                Get directions →
              </a>
              <a href="tel:+17188891777" className="block hover:text-coral">
                (718) 889-1777
              </a>
              <a href="mailto:info@wonderlandplayhouse.com" className="block hover:text-coral">
                info@wonderlandplayhouse.com
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 pt-1 text-coral hover:text-coral-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                @wonderlandplayhouseny
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

