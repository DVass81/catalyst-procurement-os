import {
  buildGuideInstructions,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
  sanitizeGuideContext,
} from "@/lib/realtime-guide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_SESSIONS_PER_WINDOW = 20;
const sessionWindows = new Map<string, { count: number; resetAt: number }>();

function requestIdentity(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local-demo"
  );
}

function withinRateLimit(identity: string) {
  const now = Date.now();
  const current = sessionWindows.get(identity);
  if (!current || current.resetAt <= now) {
    sessionWindows.set(identity, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_SESSIONS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = (process.env.DEMO_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const apparentOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;
  return origin === apparentOrigin || configured.includes(origin);
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return json({ message: "Origin not permitted." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    return json({ message: "Request context is too large." }, 413);
  }

  const identity = requestIdentity(request);
  if (!withinRateLimit(identity)) {
    return json(
      {
        message:
          "The live voice session limit has been reached. Continue with the deterministic guide.",
        mode: "deterministic-fallback",
      },
      429,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(
      {
        message:
          "Catalyst Guide Live is not configured on this deployment.",
        mode: "deterministic-fallback",
      },
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid JSON body." }, 400);
  }
  const context = sanitizeGuideContext(
    typeof body === "object" && body !== null && "context" in body
      ? (body as { context: unknown }).context
      : {},
  );

  const upstream = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model:
            process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL,
          output_modalities: ["audio"],
          instructions: buildGuideInstructions(context),
          audio: {
            input: {
              turn_detection: {
                type: "semantic_vad",
                eagerness: "medium",
                create_response: true,
                interrupt_response: true,
              },
            },
            output: {
              voice:
                process.env.OPENAI_REALTIME_VOICE ?? DEFAULT_REALTIME_VOICE,
            },
          },
        },
      }),
      cache: "no-store",
    },
  );

  if (!upstream.ok) {
    const correlationId = upstream.headers.get("x-request-id") ?? undefined;
    return json(
      {
        message:
          "Catalyst Guide Live could not start. Continue with the deterministic guide.",
        mode: "deterministic-fallback",
        correlationId,
      },
      502,
    );
  }

  return json(await upstream.json());
}
