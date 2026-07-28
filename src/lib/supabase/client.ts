"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicEnv } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const { url, key } = requireSupabasePublicEnv();
  return createBrowserClient(url, key, {
    auth: {
      flowType: "pkce",
    },
  });
}
