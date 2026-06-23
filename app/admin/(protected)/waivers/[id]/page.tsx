import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default async function WaiverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: w } = await db
    .from('waivers')
    .select(
      'id, parent_name, parent_email, parent_phone, emergency_contact_name, emergency_contact_phone, signature_data_url, signature_typed_name, document_version, signed_at, expires_at, revoked_at, revoked_reason, signature_ip, signature_ua, waiver_children(child_name, child_dob, allergies, notes)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!w) notFound();

  const expired = new Date(w.expires_at) < new Date();
  const active = !w.revoked_at && !expired;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/waivers"
          className="text-xs font-bold uppercase tracking-wider text-coral hover:text-coral-700"
        >
          ← All waivers
        </Link>
        <h1 className="mt-2 font-display text-3xl text-slate-700">{w.parent_name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed {fmtDateTime(w.signed_at)} · version {w.document_version}
        </p>
        <div className="mt-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              w.revoked_at
                ? 'bg-coral-100 text-coral-700'
                : expired
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-sky-100 text-sky-700'
            }`}
          >
            {w.revoked_at ? 'Revoked' : expired ? 'Expired' : 'Active'}
            {active && ` · expires ${fmtDate(w.expires_at)}`}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card title="Contact">
            <Row label="Email">{w.parent_email}</Row>
            <Row label="Phone">{w.parent_phone}</Row>
            <Row label="Emergency contact">
              {w.emergency_contact_name ? `${w.emergency_contact_name} — ${w.emergency_contact_phone ?? ''}` : '—'}
            </Row>
          </Card>

          <Card title={`Children covered (${w.waiver_children.length})`}>
            <div className="divide-y divide-slate-100">
              {w.waiver_children.map((c: any, i: number) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-semibold text-slate-700">{c.child_name}</p>
                  <p className="text-xs text-slate-500">
                    {c.child_dob ? `DOB: ${fmtDate(c.child_dob)}` : 'DOB not provided'}
                    {c.allergies && ` · Allergies: ${c.allergies}`}
                  </p>
                  {c.notes && <p className="mt-1 text-xs text-slate-500">{c.notes}</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Signature">
            <div className="rounded-2xl bg-slate-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={w.signature_data_url}
                alt="Parent signature"
                className="max-h-44 w-full bg-white rounded-xl border border-slate-200"
              />
            </div>
            <p className="mt-3 text-sm text-slate-600">
              <strong>Printed name:</strong> {w.signature_typed_name}
            </p>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Audit trail">
            <Row label="Signed at">{fmtDateTime(w.signed_at)}</Row>
            <Row label="Expires">{fmtDateTime(w.expires_at)}</Row>
            <Row label="Document version">{w.document_version}</Row>
            <Row label="IP">{w.signature_ip ?? '—'}</Row>
            <Row label="User agent" mono>{w.signature_ua ?? '—'}</Row>
            {w.revoked_at && (
              <>
                <Row label="Revoked at">{fmtDateTime(w.revoked_at)}</Row>
                <Row label="Reason">{w.revoked_reason ?? '—'}</Row>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-display text-lg text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="flex-shrink-0 text-slate-500">{label}</dt>
      <dd className={`text-right text-slate-700 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {children}
      </dd>
    </div>
  );
}
