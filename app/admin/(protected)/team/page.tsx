import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { AddAdminForm } from './AddAdminForm';
import { RowActions } from './RowActions';

export const dynamic = 'force-dynamic';

type AdminRow = {
  id: string;
  email: string;
  role: 'owner' | 'staff' | 'readonly';
  display_name: string | null;
  active: boolean;
  last_signed_in_at: string | null;
  created_at: string;
};

export default async function TeamPage() {
  const me = await requireOwner();

  const db = supabaseAdmin();
  const { data: admins = [] } = await db
    .from('admin_users')
    .select('id, email, role, display_name, active, last_signed_in_at, created_at')
    .order('active', { ascending: false })
    .order('created_at', { ascending: true });

  const rows = (admins ?? []) as AdminRow[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-slate-700">Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage who can access this admin dashboard. Only owners see this page.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg text-slate-700">Invite a teammate</h2>
        <p className="mt-1 text-sm text-slate-500">
          They&rsquo;ll be able to sign in via magic-link after you add them here.
        </p>
        <AddAdminForm />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-display text-lg text-slate-700">
            Current team — {rows.length}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Last signed in</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {r.display_name ?? r.email}
                      {r.id === me.id && (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-600">
                          You
                        </span>
                      )}
                    </div>
                    {r.display_name && (
                      <div className="text-xs text-slate-500">{r.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RolePill role={r.role} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.last_signed_in_at
                      ? fmtAgo(r.last_signed_in_at)
                      : <span className="text-slate-400">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.active ? (
                      <span className="rounded-full bg-coral-100 px-2 py-0.5 text-xs font-semibold text-coral-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      adminId={r.id}
                      currentRole={r.role}
                      currentActive={r.active}
                      isSelf={r.id === me.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        <strong>Owner</strong> = full access, can manage team. <strong>Staff</strong> = manage
        bookings &amp; customers. <strong>Readonly</strong> = view only.
      </p>
    </div>
  );
}

function RolePill({ role }: { role: 'owner' | 'staff' | 'readonly' }) {
  const styles: Record<string, string> = {
    owner: 'bg-coral-100 text-coral-700',
    staff: 'bg-sky-100 text-sky-600',
    readonly: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles[role]}`}>
      {role}
    </span>
  );
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
