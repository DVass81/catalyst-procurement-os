import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabasePublicEnv } from "@/lib/supabase/env";

export function createSupabasePrivateClient() {
  const { url } = requireSupabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("The private Supabase client is not configured.");
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: { schema: "private" },
  });
}

export function createSupabaseServiceClient() {
  const { url } = requireSupabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("The Supabase service client is not configured.");
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
