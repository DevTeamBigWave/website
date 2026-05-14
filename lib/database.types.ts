// Placeholder Supabase types.
// Regenerate from the real project with:
//   pnpm db:types
// (requires SUPABASE_PROJECT_ID and supabase CLI auth)
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
