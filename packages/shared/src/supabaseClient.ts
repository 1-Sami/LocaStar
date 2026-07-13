import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<"public">
): SupabaseClient {
  return createClient(url, anonKey, options);
}
