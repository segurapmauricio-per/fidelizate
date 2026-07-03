import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente admin server-only. Usa la service role key: NUNCA exponer al cliente.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "branding";
}

export function isSupabaseStorageEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
