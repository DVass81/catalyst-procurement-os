import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/confirm/route";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  recordJitIdentityRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/server/auth/jit", () => ({
  recordJitIdentityRequest: mocks.recordJitIdentityRequest,
}));

function request(tokenHash = "scanner_safe_token_hash_123456789") {
  return new Request("https://functional.example/auth/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Catalyst-Correlation-Id":
        "11111111-1111-4111-8111-111111111111",
    },
    body: JSON.stringify({ tokenHash, type: "email", next: "/dashboard" }),
  });
}

function client(input: { assigned?: boolean; verifyError?: boolean } = {}) {
  const user = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "catalyst-ft-y12-requester@iccinternational.com",
  };
  return {
    auth: {
      verifyOtp: vi.fn(async () =>
        input.verifyError
          ? { data: { user: null }, error: new Error("used") }
          : { data: { user }, error: null },
      ),
      signOut: vi.fn(async () => ({ error: null })),
      getClaims: vi.fn(async () => ({
        data: { claims: { amr: [{ method: "otp" }] } },
        error: null,
      })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        })),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: input.assigned === false ? [] : [{ tenant_id: "org-y12-demo" }],
          error: null,
        })),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
});

describe("scanner-resistant authentication confirmation", () => {
  it("exchanges the token only after the explicit POST confirmation", async () => {
    const supabase = client();
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      code: "AUTH_CONFIRMED",
      redirectTo: "/dashboard",
      correlationId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects an expired or previously used link with a stable JSON error", async () => {
    const supabase = client({ verifyError: true });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "AUTH_LINK_INVALID_OR_USED",
    });
  });

  it("fails closed and clears the session when no assignment exists", async () => {
    const supabase = client({ assigned: false });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.recordJitIdentityRequest).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "AUTH_INVITATION_REQUIRED",
    });
  });
});
