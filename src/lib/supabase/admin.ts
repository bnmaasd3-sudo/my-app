import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Service-role client, used only to create sign-in accounts for new readers.
 * Null when SUPABASE_SERVICE_ROLE_KEY is not set (it is a server-only secret
 * and must never be a NEXT_PUBLIC_ variable).
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(supabaseEnv().url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
