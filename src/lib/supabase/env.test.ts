import { describe, expect, it } from "vitest";

import {
  isSupabaseConfigured,
  resolveSupabasePublicEnv,
} from "@/lib/supabase/env";

describe("runtime Supabase configuration", () => {
  it("prefers runtime-only values so one image can serve isolated projects", () => {
    expect(
      resolveSupabasePublicEnv({
        SUPABASE_URL: "https://runtime.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "runtime-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://legacy.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "legacy-key",
      }),
    ).toEqual({
      url: "https://runtime.supabase.co",
      key: "runtime-key",
    });
  });

  it("keeps the published development preview compatible while rejecting partial config", () => {
    expect(
      isSupabaseConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "https://preview.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "preview-key",
      }),
    ).toBe(true);
    expect(
      isSupabaseConfigured({
        SUPABASE_URL: "https://partial.supabase.co",
      }),
    ).toBe(false);
  });
});
