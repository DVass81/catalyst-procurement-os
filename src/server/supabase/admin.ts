import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createSupabasePrivateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
