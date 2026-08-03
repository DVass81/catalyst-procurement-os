"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient(input: {
  url: string;
  publishableKey: string;
}) {
  const { url, publishableKey } = input;
  if (!url || !publishableKey) {
    throw new Error("Supabase browser configuration was not supplied.");
  }
  return createBrowserClient(url, publishableKey, {
    auth: {
      flowType: "pkce",
    },
  });
}
