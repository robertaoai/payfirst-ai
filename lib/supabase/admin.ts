import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase admin client using the service role key when available,
 * falling back to anon key for v1 open RLS policies.
 * 
 * Use this in server-side API routes (webhooks, admin reads, tracking inserts).
 * Never import this in client-side code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Prefer service role key, but fall back to anon key for v1 (open RLS)
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
