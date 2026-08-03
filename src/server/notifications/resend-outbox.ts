import "server-only";

import { createSupabaseServiceClient } from "@/server/supabase/admin";

interface EmailOutboxRow {
  id: string;
  tenant_id: string;
  recipient_id: string | null;
  subject: string;
  safe_body: string;
  deep_link: string | null;
  dedupe_key: string;
  event_type: string;
  correlation_id: string | null;
  attempts: number;
  delivery_state: "pending" | "failed";
  next_attempt_at: string | null;
}

const resendEndpoint = "https://api.resend.com/emails";

function publicApplicationUrl() {
  const value = process.env.APP_BASE_URL?.trim();
  if (!value) throw new Error("NOTIFICATION_PUBLIC_ORIGIN_UNAVAILABLE");
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("NOTIFICATION_PUBLIC_ORIGIN_INVALID");
  }
  return url;
}

function retryAt(attempts: number) {
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function deliverPendingNotifications(limit = 10) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return { configured: false, attempted: 0, delivered: 0, failed: 0 };
  }
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("notification_outbox")
    .select(
      "id,tenant_id,recipient_id,subject,safe_body,deep_link,dedupe_key,event_type,correlation_id,attempts,delivery_state,next_attempt_at",
    )
    .eq("channel", "email")
    .in("delivery_state", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit * 2, 50)));
  if (error) throw new Error("NOTIFICATION_OUTBOX_UNAVAILABLE");

  const now = Date.now();
  const candidates = ((data ?? []) as EmailOutboxRow[])
    .filter(
      (row) =>
        !row.next_attempt_at || new Date(row.next_attempt_at).getTime() <= now,
    )
    .slice(0, limit);
  let delivered = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const attempt = candidate.attempts + 1;
    const { data: claimed } = await supabase
      .from("notification_outbox")
      .update({
        delivery_state: "processing",
        attempts: attempt,
        provider: "resend",
        last_error: null,
      })
      .eq("id", candidate.id)
      .eq("delivery_state", candidate.delivery_state)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      if (!candidate.recipient_id) {
        throw new Error("NOTIFICATION_RECIPIENT_UNAVAILABLE");
      }
      const { data: userResult, error: userError } =
        await supabase.auth.admin.getUserById(candidate.recipient_id);
      const recipient = userResult.user?.email;
      if (userError || !recipient) {
        throw new Error("NOTIFICATION_RECIPIENT_UNAVAILABLE");
      }
      const actionUrl = new URL(
        candidate.deep_link ?? "/dashboard",
        publicApplicationUrl(),
      ).toString();
      const response = await fetch(resendEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": candidate.id,
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: candidate.subject,
          text: `${candidate.safe_body}\n\nOpen Catalyst: ${actionUrl}`,
          headers: {
            "X-Catalyst-Correlation-Id":
              candidate.correlation_id ?? candidate.id,
          },
          tags: [
            { name: "event", value: candidate.event_type.replaceAll(".", "-") },
            { name: "tenant", value: candidate.tenant_id.replaceAll("_", "-") },
          ],
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { id?: string }
        | null;
      if (!response.ok || !result?.id) {
        throw new Error(`RESEND_HTTP_${response.status}`);
      }
      const { error: deliveryError } = await supabase
        .from("notification_outbox")
        .update({
          delivery_state: "delivered",
          delivered_at: new Date().toISOString(),
          provider_message_id: result.id,
          next_attempt_at: null,
          delivery_evidence: {
            provider: "resend",
            providerMessageId: result.id,
            idempotencyKey: candidate.id,
            delivered: true,
          },
        })
        .eq("id", candidate.id)
        .eq("delivery_state", "processing");
      if (deliveryError) throw new Error("NOTIFICATION_EVIDENCE_WRITE_FAILED");
      delivered += 1;
    } catch (deliveryError) {
      const terminal = attempt >= 4;
      await supabase
        .from("notification_outbox")
        .update({
          delivery_state: terminal ? "dead_letter" : "failed",
          next_attempt_at: terminal ? null : retryAt(attempt),
          terminal_failed_at: terminal ? new Date().toISOString() : null,
          last_error:
            deliveryError instanceof Error
              ? deliveryError.message.slice(0, 160)
              : "NOTIFICATION_DELIVERY_FAILED",
          delivery_evidence: {
            provider: "resend",
            delivered: false,
            terminal,
            attempt,
          },
        })
        .eq("id", candidate.id)
        .eq("delivery_state", "processing");
      failed += 1;
    }
  }
  return {
    configured: true,
    attempted: delivered + failed,
    delivered,
    failed,
  };
}
