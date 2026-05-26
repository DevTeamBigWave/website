import Link from 'next/link';
import { requireOwner } from '@/lib/admin';
import { CreatePartyForm } from './CreatePartyForm';

export const dynamic = 'force-dynamic';

export default async function NewPartyPage() {
  await requireOwner();

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/parties"
          className="text-xs font-bold uppercase tracking-wider text-coral hover:text-coral-700"
        >
          ← All parties
        </Link>
        <h1 className="mt-2 font-display text-3xl text-slate-700">New party</h1>
        <p className="mt-1 text-sm text-slate-500">
          Walk-in / phone booking. Creates the party + sends the invoice (full or
          deposit) in one shot.
        </p>
      </header>

      <CreatePartyForm />
    </div>
  );
}
