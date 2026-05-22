import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type AdminRole = 'owner' | 'staff' | 'readonly';

export type AdminProfile = {
  id: string;
  email: string;
  role: AdminRole;
  displayName: string | null;
};

// Returns the auth user (from Supabase Auth) and a session-aware supabase client.
// Does NOT enforce admin allowlist — use requireAdmin() for that.
export async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(url(), anonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // server-component context — ignore
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}

// Enforces: signed in AND email in admin_users with active=true.
// Use at the top of every protected admin server component / action.
export async function requireAdmin(): Promise<AdminProfile> {
  const { user } = await getAuthUser();
  if (!user || !user.email) {
    redirect('/admin/login');
  }

  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from('admin_users')
    .select('id, email, role, display_name, active')
    .ilike('email', user.email)
    .eq('active', true)
    .maybeSingle();

  if (!row) {
    redirect('/admin/login?error=not_allowlisted');
  }

  // Fire-and-forget last-signed-in timestamp
  void admin
    .from('admin_users')
    .update({ last_signed_in_at: new Date().toISOString() })
    .eq('id', row.id);

  return {
    id: row.id,
    email: row.email,
    role: row.role as AdminRole,
    displayName: row.display_name,
  };
}
