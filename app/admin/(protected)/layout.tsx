import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

const baseNav = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/revenue', label: 'Revenue' },
  { href: '/admin/labor', label: 'Labor' },
  { href: '/admin/parties', label: 'Parties' },
  { href: '/admin/memberships', label: 'Memberships' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/waivers', label: 'Waivers' },
  { href: '/admin/waiver-qr', label: 'Waiver QR' },
  { href: '/admin/gift-cards', label: 'Gift Cards' },
  { href: '/admin/marketing', label: 'Marketing' },
  { href: '/admin/blog', label: 'Blog' },
];

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const me = await requireAdmin();
  const nav =
    me.role === 'owner'
      ? [
          ...baseNav,
          { href: '/admin/promo-codes', label: 'Promo codes' },
          { href: '/admin/integrations/google', label: 'Calendar' },
          { href: '/admin/integrations/gbp', label: 'Hours' },
          { href: '/admin/team', label: 'Team' },
        ]
      : baseNav;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Link href="/admin" className="whitespace-nowrap font-display text-lg text-slate-700">
              <span className="text-coral">Wonderland</span> Admin
            </Link>
            <nav
              className="hidden min-w-0 flex-1 gap-1 overflow-x-auto xl:flex"
              style={{
                maskImage:
                  'linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)',
              }}
            >
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="hidden max-w-[160px] truncate text-sm text-slate-500 lg:inline">
              {me.displayName ?? me.email}
            </span>
            <Link
              href="/"
              target="_blank"
              rel="noopener"
              className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-coral hover:text-coral"
            >
              View site ↗
            </Link>
            <form action="/admin/auth/signout" method="post">
              <button
                type="submit"
                className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-coral hover:text-coral"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 xl:hidden"
          style={{
            maskImage:
              'linear-gradient(to right, black 0, black calc(100% - 28px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, black 0, black calc(100% - 28px), transparent 100%)',
          }}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main
        className="mx-auto max-w-7xl overflow-x-hidden px-4 py-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
    </div>
  );
}
