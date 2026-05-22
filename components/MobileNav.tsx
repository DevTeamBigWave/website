'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

type NavItem = { href: string; label: string };

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the panel whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when the menu is open
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
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <div className="absolute inset-x-0 top-0 rounded-b-3xl bg-cream p-6 shadow-card">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg text-slate-700">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-coral hover:text-coral"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-4 py-3 text-lg font-semibold text-slate-700 transition hover:bg-white hover:text-coral"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <Link
              href="/parties"
              className="mt-6 flex items-center justify-center rounded-full bg-coral px-6 py-3 text-base font-bold text-white shadow-playful transition hover:bg-coral-600"
            >
              Book a Party
            </Link>

            <div className="mt-6 space-y-1 border-t border-slate-100 pt-5 text-sm text-slate-500">
              <p>3830 Nostrand Ave, Brooklyn</p>
              <p>
                <a href="tel:+17188891777" className="hover:text-coral">
                  (718) 889-1777
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
