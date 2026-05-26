'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminInvite } from '@/lib/email';

export type TeamActionState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const VALID_ROLES = ['owner', 'staff', 'readonly'] as const;
type Role = (typeof VALID_ROLES)[number];

export async function addAdmin(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const me = await requireOwner();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const displayName = String(formData.get('display_name') ?? '').trim() || null;
  const role = String(formData.get('role') ?? 'staff') as Role;

  if (!email || !email.includes('@')) {
    return { status: 'error', message: 'Valid email required.' };
  }
  if (!VALID_ROLES.includes(role)) {
    return { status: 'error', message: 'Invalid role.' };
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('admin_users')
    .insert({ email, role, display_name: displayName, active: true });

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: 'That email is already an admin.' };
    }
    return { status: 'error', message: error.message };
  }

  // Send branded invite email — non-blocking so a Resend hiccup doesn't fail the add.
  try {
    await sendAdminInvite({
      invitee_email: email,
      invitee_display_name: displayName,
      role,
      invited_by_name: me.displayName ?? me.email,
    });
  } catch (err) {
    console.error('Admin invite email failed:', err);
    revalidatePath('/admin/team');
    return {
      status: 'success',
      message: `Added ${email}, but invite email failed to send. Tell them manually.`,
    };
  }

  revalidatePath('/admin/team');
  return { status: 'success', message: `Added ${email} and sent invite email.` };
}

export async function toggleActive(adminId: string, makeActive: boolean): Promise<void> {
  const me = await requireOwner();

  if (adminId === me.id && !makeActive) {
    throw new Error('You cannot deactivate yourself.');
  }

  const db = supabaseAdmin();
  await db.from('admin_users').update({ active: makeActive }).eq('id', adminId);
  revalidatePath('/admin/team');
}

export async function updateRole(adminId: string, role: Role): Promise<void> {
  const me = await requireOwner();

  if (!VALID_ROLES.includes(role)) {
    throw new Error('Invalid role');
  }

  if (adminId === me.id && role !== 'owner') {
    throw new Error('You cannot demote yourself.');
  }

  // Don't allow removing the last owner
  if (role !== 'owner') {
    const db = supabaseAdmin();
    const { count } = await db
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'owner')
      .eq('active', true);
    if ((count ?? 0) <= 1) {
      const { data: target } = await db
        .from('admin_users')
        .select('role, active')
        .eq('id', adminId)
        .maybeSingle();
      if (target?.role === 'owner' && target.active) {
        throw new Error('Cannot demote the last active owner.');
      }
    }
  }

  const db = supabaseAdmin();
  await db.from('admin_users').update({ role }).eq('id', adminId);
  revalidatePath('/admin/team');
}
