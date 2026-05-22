import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

const nav = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/parties', label: 'Parties' },
  { href: '/admin/customers', label: 'Customers' },
];

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const me = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-display text-lg text-slate-700">
              <span className="text-coral">Wonderland</span> Admin
            </Link>
            <nav className="hidden gap-1 md:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {me.displayName ?? me.email}
            </span>
            <form action="/admin/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-coral hover:text-coral"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
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
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
