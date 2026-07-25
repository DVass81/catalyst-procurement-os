import {
  buildElevenLabsNarrationRequest,
  DEFAULT_ELEVENLABS_MODEL,
  normalizeNarrationInput,
} from "@/lib/elevenlabs-narration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 80;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function requestIdentity(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local-demo"
  );
}

function withinRateLimit(identity: string) {
  const now = Date.now();
  const current = requestWindows.get(identity);
  if (!current || current.resetAt <= now) {
    requestWindows.set(identity, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
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

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return json({ message: "Origin not permitted." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    return json({ message: "Narration request is too large." }, 413);
  }

  if (!withinRateLimit(requestIdentity(request))) {
    return json(
      {
        message:
          "Natural narration is temporarily rate limited. Browser narration remains available.",
        mode: "browser-fallback",
      },
      429,
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return json(
      {
        message:
          "Natural narration is not configured. Browser narration remains available.",
        mode: "browser-fallback",
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

  const text = normalizeNarrationInput(
    typeof body === "object" && body !== null && "text" in body
      ? (body as { text: unknown }).text
      : undefined,
  );
  if (!text) {
    return json({ message: "Valid narration text is required." }, 400);
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId,
    )}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(
        buildElevenLabsNarrationRequest(
          text,
          process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_ELEVENLABS_MODEL,
        ),
      ),
      cache: "no-store",
    },
  );

  if (!upstream.ok || !upstream.body) {
    return json(
      {
        message:
          "Natural narration could not be generated. Browser narration remains available.",
        mode: "browser-fallback",
        correlationId: upstream.headers.get("request-id") ?? undefined,
      },
      502,
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="catalyst-guide.mp3"',
    },
  });
}

