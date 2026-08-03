import { beforeEach, describe, expect, it, vi } from "vitest";

import { deliverPendingNotifications } from "@/server/notifications/resend-outbox";

const mocks = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/server/supabase/admin", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

function candidate(attempts = 0) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "org-y12-demo",
    recipient_id: "22222222-2222-4222-8222-222222222222",
    subject: "Catalyst RFQ invitation",
    safe_body: "A governed synthetic RFQ invitation is available.",
    deep_link: "/rfqs",
    dedupe_key: "rfq:invitation",
    event_type: "rfq.invitation.issued",
    correlation_id: "33333333-3333-4333-8333-333333333333",
    attempts,
    delivery_state: "pending" as const,
    next_attempt_at: null,
  };
}

function fakeSupabase(row = candidate()) {
  const updates: Array<Record<string, unknown>> = [];
  const selectChain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => ({ data: [row], error: null })),
  };
  selectChain.select.mockReturnValue(selectChain);
  selectChain.eq.mockReturnValue(selectChain);
  selectChain.in.mockReturnValue(selectChain);
  selectChain.order.mockReturnValue(selectChain);

  const from = vi.fn(() => ({
    select: selectChain.select,
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      const chain: {
        eq: ReturnType<typeof vi.fn>;
        select: ReturnType<typeof vi.fn>;
        maybeSingle: ReturnType<typeof vi.fn>;
        then: (resolve: (value: { error: null }) => void) => void;
      } = {
        eq: vi.fn(),
        select: vi.fn(),
        maybeSingle: vi.fn(async () => ({ data: { id: row.id }, error: null })),
        then(resolve) {
          resolve({ error: null });
        },
      };
      chain.eq.mockReturnValue(chain);
      chain.select.mockReturnValue(chain);
      return chain;
    }),
  }));
  return {
    client: {
      from,
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: {
              user: {
                email: "catalyst-ft-y12-supplier-a@iccinternational.com",
              },
            },
            error: null,
          })),
        },
      },
    },
    updates,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env.RESEND_API_KEY = "resend-test-key";
  process.env.RESEND_FROM_EMAIL =
    "Catalyst Access <no-reply@auth.iccinternational.com>";
  process.env.APP_BASE_URL = "https://functional.example";
});

describe("Resend notification outbox", () => {
  it("uses provider idempotency and records delivery evidence", async () => {
    const database = fakeSupabase();
    mocks.createSupabaseServiceClient.mockReturnValue(database.client);
    const providerFetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: "resend-message-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", providerFetch);

    await expect(deliverPendingNotifications(10)).resolves.toEqual({
      configured: true,
      attempted: 1,
      delivered: 1,
      failed: 0,
    });
    expect(providerFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );
    expect(database.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ delivery_state: "processing", attempts: 1 }),
        expect.objectContaining({
          delivery_state: "delivered",
          provider_message_id: "resend-message-1",
        }),
      ]),
    );
  });

  it("moves the fourth failed attempt to a terminal dead letter", async () => {
    const database = fakeSupabase(candidate(3));
    mocks.createSupabaseServiceClient.mockReturnValue(database.client);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "provider unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(deliverPendingNotifications(10)).resolves.toEqual({
      configured: true,
      attempted: 1,
      delivered: 0,
      failed: 1,
    });
    expect(database.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          delivery_state: "dead_letter",
          next_attempt_at: null,
          last_error: "RESEND_HTTP_503",
        }),
      ]),
    );
  });
});
