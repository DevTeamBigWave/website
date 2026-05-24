'use client';

import { useTransition } from 'react';
import { disconnectGoogleCalendar } from './actions';

export function DisconnectButton() {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm('Disconnect Google Calendar? New parties will no longer sync.')) return;
    startTransition(async () => {
      await disconnectGoogleCalendar();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-coral hover:text-coral disabled:opacity-50"
    >
      {pending ? 'Disconnecting…' : 'Disconnect'}
    </button>
  );
}
