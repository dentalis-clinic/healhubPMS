import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/generated/supabase/database.types";

/**
 * Supabase admin client using the service role key.
 * Only for server-side use — never import this in client components.
 * Use for privileged operations: creating users, bypassing RLS, etc.
 *
 * Typed against the generated schema — run `npm run db:types` after migrations.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
