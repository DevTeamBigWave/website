'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function PartyActions({
  partyId,
  balanceDueCents,
  invoiceSentAt,
  hostedInvoiceUrl,
  balancePaidAt,
  planningCallSentAt,
}: {
  partyId: string;
  balanceDueCents: number;
  invoiceSentAt: string | null;
  hostedInvoiceUrl: string | null;
  balancePaidAt: string | null;
  planningCallSentAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sendPlanningCall = async () => {
    if (busy) return;
    const verb = planningCallSentAt ? 'Re-send' : 'Send';
    if (!confirm(`${verb} the planning-call invite email to this parent?`)) return;
    setBusy('planning');
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/email/planning-call`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${data.error ?? 'failed'}`);
      } else {
        setFeedback('Email sent ✓');
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const sendInvoice = async () => {
    if (busy) return;
    if (balanceDueCents <= 0) {
      setFeedback('Nothing to invoice — balance is $0.');
      return;
    }
    const verb = invoiceSentAt ? 'Re-issue' : 'Send';
    if (
      !confirm(
        `${verb} a Stripe invoice for ${fmt(balanceDueCents)}? The parent will get an email with a branded hosted invoice link.${invoiceSentAt ? ' Any prior unpaid invoice will be voided.' : ''}`,
      )
    ) {
      return;
    }
    setBusy('invoice');
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/parties/${partyId}/invoice`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${data.error ?? 'failed'}`);
      } else {
        setFeedback(`Invoice sent for ${fmt(data.balanceDueCents)} ✓`);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <ActionRow
        title="Planning-call invite"
        description="Sends the parent a branded email with a link to schedule a 30-min planning call."
        actionLabel={planningCallSentAt ? 'Re-send planning email' : 'Send planning email'}
        helper={planningCallSentAt ? `Last sent ${new Date(planningCallSentAt).toLocaleDateString()}` : undefined}
        onClick={sendPlanningCall}
        loading={busy === 'planning'}
      />
      <ActionRow
        title={`Balance invoice · ${fmt(balanceDueCents)}`}
        description="Creates a Stripe Invoice with the package + every add-on itemized, deposit credited, and a hosted pay link."
        actionLabel={invoiceSentAt ? 'Re-issue invoice' : 'Send balance invoice'}
        helper={
          balancePaidAt
            ? `Paid ${new Date(balancePaidAt).toLocaleDateString()} ✓`
            : invoiceSentAt
              ? `Sent ${new Date(invoiceSentAt).toLocaleDateString()}`
              : undefined
        }
        actionLink={invoiceSentAt && hostedInvoiceUrl ? hostedInvoiceUrl : undefined}
        actionLinkLabel="View invoice ↗"
        onClick={sendInvoice}
        loading={busy === 'invoice'}
        disabled={balanceDueCents <= 0 || !!balancePaidAt}
      />
      {feedback && (
        <p className="text-xs text-slate-600">{feedback}</p>
      )}
    </div>
  );
}

function ActionRow({
  title,
  description,
  actionLabel,
  helper,
  onClick,
  loading,
  disabled,
  actionLink,
  actionLinkLabel,
}: {
  title: string;
  description: string;
  actionLabel: string;
  helper?: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  actionLink?: string;
  actionLinkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actionLink && (
          <a
            href={actionLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-coral hover:text-coral"
          >
            {actionLinkLabel ?? 'View'}
          </a>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={loading || disabled}
          className="rounded-full bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Working…' : actionLabel}
        </button>
      </div>
    </div>
  );
}
