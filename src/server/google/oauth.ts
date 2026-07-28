import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";

import type { AppSession } from "@/server/auth/session";
import {
  CALENDAR_DEMO_NAME,
  GMAIL_DEMO_LABEL,
  GOOGLE_SCOPES,
  isGoogleLiveConfigured,
} from "@/server/google/operations";
import { encryptToken } from "@/server/security/encryption";
import { createSupabasePrivateClient } from "@/server/supabase/admin";

interface OAuthState {
  userId: string;
  expiresAt: number;
  nonce: string;
}

function stateSecret() {
  return process.env.GOOGLE_OAUTH_STATE_SECRET ?? process.env.ACTION_CONFIRMATION_SECRET;
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_BASE_URL}/api/google/callback`,
  );
}

function sign(value: string) {
  const secret = stateSecret();
  if (!secret) throw new Error("GOOGLE_OAUTH_STATE_SECRET is not configured.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createOAuthState(session: AppSession) {
  const payload: OAuthState = {
    userId: session.userId,
    expiresAt: Date.now() + 10 * 60_000,
    nonce: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyOAuthState(value: string, session: AppSession) {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return false;
  const expected = Buffer.from(sign(encoded));
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return false;
  }
  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as OAuthState;
  return payload.userId === session.userId && payload.expiresAt > Date.now();
}

export function googleAuthorizationUrl(session: AppSession) {
  if (!isGoogleLiveConfigured()) {
    throw new Error("Google OAuth is not configured.");
  }
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [...GOOGLE_SCOPES],
    state: createOAuthState(session),
  });
}

export async function completeGoogleConnection(
  session: AppSession,
  code: string,
) {
  const auth = oauthClient();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke the prior grant and reconnect.",
    );
  }
  auth.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth });
  const [profile, labels] = await Promise.all([
    gmail.users.getProfile({ userId: "me" }),
    gmail.users.labels.list({ userId: "me" }),
  ]);
  const label = labels.data.labels?.find(
    (candidate) => candidate.name === GMAIL_DEMO_LABEL,
  );

  const calendar = google.calendar({ version: "v3", auth });
  const createdCalendar = await calendar.calendars.insert({
    requestBody: {
      summary: CALENDAR_DEMO_NAME,
      description:
        "App-created secondary calendar used only for confirmed Catalyst Procurement OS demonstration events.",
      timeZone: "America/New_York",
    },
  });
  const calendarId = createdCalendar.data.id;
  const status = label?.id && calendarId ? "connected" : "limited";

  const client = createSupabasePrivateClient();
  const { error } = await client.from("google_connections").upsert(
    {
      user_id: session.userId,
      encrypted_refresh_token: encryptToken(tokens.refresh_token),
      google_email: profile.data.emailAddress ?? session.email,
      gmail_label_id: label?.id ?? null,
      calendar_id: calendarId ?? null,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return { status };
}
