import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAppSession } from "@/server/auth/session";

const noStore = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function GET(request: Request) {
  const correlationId =
    request.headers.get("x-catalyst-correlation-id") ?? crypto.randomUUID();
  try {
    await requireAppSession();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("notification_outbox")
      .select(
        "id,subject,safe_body,deep_link,mandatory,acknowledged_at,created_at,delivery_state",
      )
      .eq("channel", "in_app")
      .eq("delivery_state", "delivered")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("NOTIFICATION_INBOX_UNAVAILABLE");
    return NextResponse.json(
      {
        success: true,
        code: "NOTIFICATIONS_LOADED",
        message: "Authorized notifications loaded.",
        correlationId,
        notifications: (data ?? []).map((notification) => ({
          id: notification.id,
          title: notification.subject,
          description: notification.safe_body,
          href: notification.deep_link ?? "/dashboard",
          occurredAt: notification.created_at,
          read: Boolean(notification.acknowledged_at),
          mandatory: notification.mandatory,
        })),
      },
      {
        headers: { ...noStore, "X-Catalyst-Correlation-Id": correlationId },
      },
    );
  } catch (error) {
    const authenticationRequired =
      error instanceof Error && error.message === "AUTHENTICATION_REQUIRED";
    return NextResponse.json(
      {
        success: false,
        code: authenticationRequired
          ? "AUTHENTICATION_REQUIRED"
          : "NOTIFICATION_INBOX_UNAVAILABLE",
        correlationId,
        message: authenticationRequired
          ? "Authentication is required."
          : "The notification inbox is temporarily unavailable.",
      },
      {
        status: authenticationRequired ? 401 : 503,
        headers: { ...noStore, "X-Catalyst-Correlation-Id": correlationId },
      },
    );
  }
}
