'use client';

import { useTransition } from 'react';
import { toggleActive, updateRole } from './actions';

type Role = 'owner' | 'staff' | 'readonly';

export function RowActions({
  adminId,
  currentRole,
  currentActive,
  isSelf,
}: {
  adminId: string;
  currentRole: Role;
  currentActive: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as Role;
    if (role === currentRole) return;
    if (!confirm(`Change role to ${role}?`)) {
      e.target.value = currentRole;
      return;
    }
    startTransition(async () => {
      try {
        await updateRole(adminId, role);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update role');
        e.target.value = currentRole;
      }
    });
  };

  const onToggle = () => {
    const action = currentActive ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} this admin?`)) return;
    startTransition(async () => {
      try {
        await toggleActive(adminId, !currentActive);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed');
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      <select
        defaultValue={currentRole}
        onChange={onRoleChange}
        disabled={pending}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-50"
      >
        <option value="owner">Owner</option>
        <option value="staff">Staff</option>
        <option value="readonly">Readonly</option>
      </select>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending || isSelf}
        title={isSelf ? "You can't deactivate yourself" : ''}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          currentActive
            ? 'border border-slate-200 text-slate-600 hover:border-coral hover:text-coral'
            : 'bg-sky-600 text-white hover:bg-sky-700'
        }`}
      >
        {currentActive ? 'Deactivate' : 'Reactivate'}
      </button>
    </div>
  );
}
