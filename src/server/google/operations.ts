import "server-only";

import { google } from "googleapis";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppSession } from "@/server/auth/session";
import { decryptToken } from "@/server/security/encryption";
import { createSupabasePrivateClient } from "@/server/supabase/admin";

export const GMAIL_DEMO_LABEL = "Catalyst Procurement Demo";
export const CALENDAR_DEMO_NAME = "Catalyst Procurement Demo";
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.app.created",
] as const;

interface GoogleConnectionRow {
  user_id: string;
  encrypted_refresh_token: string;
  google_email: string;
  gmail_label_id: string | null;
  calendar_id: string | null;
  status: "connected" | "limited" | "revoked";
}

export function isGoogleLiveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.TOKEN_ENCRYPTION_KEY &&
      process.env.SUPABASE_SECRET_KEY &&
      isSupabaseConfigured(),
  );
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_BASE_URL}/api/google/callback`,
  );
}

async function connectionFor(session: AppSession) {
  if (!isGoogleLiveConfigured()) return null;
  const client = createSupabasePrivateClient();
  const { data, error } = await client
    .from("google_connections")
    .select(
      "user_id,encrypted_refresh_token,google_email,gmail_label_id,calendar_id,status",
    )
    .eq("user_id", session.userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as GoogleConnectionRow;
}

async function authorizedGoogle(session: AppSession) {
  const connection = await connectionFor(session);
  if (!connection || connection.status === "revoked") return null;
  const auth = oauthClient();
  auth.setCredentials({
    refresh_token: decryptToken(connection.encrypted_refresh_token),
  });
  return { auth, connection };
}

export async function getGoogleStatus(session: AppSession) {
  const connection = await connectionFor(session);
  if (!connection) {
    return {
      connected: false,
      mode: isGoogleLiveConfigured() ? "disabled" : "simulated",
      gmailLabel: GMAIL_DEMO_LABEL,
      calendarName: CALENDAR_DEMO_NAME,
      reason: isGoogleLiveConfigured()
        ? "Connect Daniel’s account to enable the live connector."
        : "Google OAuth is not configured; simulated data is active.",
      scopes: [...GOOGLE_SCOPES],
    } as const;
  }
  return {
    connected: connection.status === "connected",
    mode: connection.status === "connected" ? "live" : "simulated",
    email: connection.google_email,
    gmailLabel: GMAIL_DEMO_LABEL,
    calendarName: CALENDAR_DEMO_NAME,
    reason:
      connection.status === "limited"
        ? "The required Gmail label or app-created calendar is not ready."
        : undefined,
    scopes: [...GOOGLE_SCOPES],
  } as const;
}

export async function createGmailDraft(session: AppSession) {
  const live = await authorizedGoogle(session);
  if (!live) {
    return {
      mode: "simulated" as const,
      id: `sim-draft-${crypto.randomUUID()}`,
      message:
        "Simulated Gmail draft created. No Google account was changed and no email was sent.",
    };
  }
  const gmail = google.gmail({ version: "v1", auth: live.auth });
  const mime = [
    "Subject: Fictional equipment quote follow-up",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Thank you for the fictional quote. Please remove the unapproved $320 freight charge, confirm contract pricing, preserve the delivery date, and confirm the three-year warranty.",
    "",
    "This message is a draft created for the Catalyst Procurement OS demonstration.",
  ].join("\r\n");
  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: Buffer.from(mime).toString("base64url"),
      },
    },
  });
  return {
    mode: "live" as const,
    id: response.data.id ?? "draft-created",
    message: "Gmail draft created. It was not sent.",
  };
}

export async function createCalendarEvent(session: AppSession) {
  const live = await authorizedGoogle(session);
  if (!live || !live.connection.calendar_id) {
    return {
      mode: "simulated" as const,
      id: `sim-event-${crypto.randomUUID()}`,
      message:
        "Simulated calendar follow-up created. No Google Calendar was changed.",
    };
  }
  const start = new Date(Date.now() + 24 * 60 * 60_000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  const calendar = google.calendar({ version: "v3", auth: live.auth });
  const response = await calendar.events.insert({
    calendarId: live.connection.calendar_id,
    requestBody: {
      summary: "Fictional procurement vendor follow-up",
      description:
        "Catalyst Procurement Demo: review contract pricing, delivery, warranty, and the $320 freight exception.",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });
  return {
    mode: "live" as const,
    id: response.data.id ?? "event-created",
    message: `Calendar event created on ${CALENDAR_DEMO_NAME}.`,
  };
}

export async function listDedicatedLabelMessages(session: AppSession) {
  const live = await authorizedGoogle(session);
  if (!live || !live.connection.gmail_label_id) {
    return { mode: "simulated" as const, messages: [] };
  }
  const gmail = google.gmail({ version: "v1", auth: live.auth });
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: [live.connection.gmail_label_id],
    maxResults: 25,
  });
  return {
    mode: "live" as const,
    messages: (response.data.messages ?? []).map((message) => ({
      id: message.id,
      threadId: message.threadId,
    })),
  };
}
