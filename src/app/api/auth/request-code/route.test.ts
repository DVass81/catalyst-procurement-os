import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/request-code/route";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
});

describe("invite-only scanner-resistant sign-in requests", () => {
  it("never creates a user and directs the email to the confirmation screen", async () => {
    const signInWithOtp = vi.fn(async () => ({ error: null }));
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithOtp },
    });
    const correlationId = "33333333-3333-4333-8333-333333333333";

    const response = await POST(
      new Request("https://functional.example/api/auth/request-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Catalyst-Correlation-Id": correlationId,
        },
        body: JSON.stringify({
          email: "catalyst-ft-y12-requester@iccinternational.com",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "catalyst-ft-y12-requester@iccinternational.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo:
          "https://functional.example/auth/confirm?next=%2Fdashboard",
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      code: "AUTH_REQUEST_ACCEPTED",
      correlationId,
    });
  });

  it("uses the same accepted response when Supabase rejects an uninvited address", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        signInWithOtp: vi.fn(async () => ({ error: new Error("not invited") })),
      },
    });

    const response = await POST(
      new Request("https://functional.example/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "uninvited@example.test" }),
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      code: "AUTH_REQUEST_ACCEPTED",
    });
  });
});
