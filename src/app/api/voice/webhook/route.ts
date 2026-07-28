import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

import {
  createUsageEvent,
  recordUsage,
} from "@/server/usage/budget";

const processedConversations = new Set<string>();

export async function POST(request: Request) {
  const signature = request.headers.get("elevenlabs-signature");
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ message: "Webhook authentication required." }, { status: 401 });
  }
  const rawBody = await request.text();
  try {
    const client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
    const event = (await client.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    )) as {
      type?: string;
      data?: {
        conversation_id?: string;
        metadata?: { call_duration_secs?: number };
      };
    };
    if (event.type === "post_call_transcription") {
      const conversationId = event.data?.conversation_id;
      if (conversationId && !processedConversations.has(conversationId)) {
        processedConversations.add(conversationId);
        const duration = Math.min(
          15 * 60,
          Math.max(0, event.data?.metadata?.call_duration_secs ?? 0),
        );
        const perMinute = Number(
          process.env.ELEVENLABS_ESTIMATED_USD_PER_MINUTE ?? 0.1,
        );
        await recordUsage(
          createUsageEvent({
            tenantId: "voice-session",
            provider: "elevenlabs",
            model: "elevenlabs-agent-cate",
            capability: "application_help",
            durationSeconds: duration,
            estimatedCostUsd: (duration / 60) * perMinute,
            sessionId: conversationId,
          }),
        );
      }
    }
    // Transcript and audio content are deliberately not logged or stored.
    return NextResponse.json({ status: "received" });
  } catch {
    return NextResponse.json({ message: "Invalid webhook signature." }, { status: 401 });
  }
}
