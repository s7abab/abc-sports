import { NextResponse } from "next/server";

import { createChatMessage, readChatMessages } from "@/lib/chat-storage";
import { moderateChatMessage } from "@/lib/chat-moderation";

const MESSAGE_WINDOW_MS = 5_000;
const REACTION_WINDOW_MS = 800;
const MAX_MESSAGES_PER_WINDOW = 4;
const sendBuckets = new Map<string, number[]>();

function normalizeClientId(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const clientId = value.trim().slice(0, 80);
  return clientId || undefined;
}

function getRequesterKey(request: Request, playerId: string, author: unknown) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const normalizedAuthor = typeof author === "string" ? author.trim().toLowerCase().slice(0, 28) : "fan";
  return `${playerId}:${ip}:${normalizedAuthor || "fan"}`;
}

function isRateLimited(key: string, kind: "message" | "reaction") {
  const now = Date.now();
  const windowMs = kind === "reaction" ? REACTION_WINDOW_MS : MESSAGE_WINDOW_MS;
  const maxHits = kind === "reaction" ? 1 : MAX_MESSAGES_PER_WINDOW;
  const recentHits = (sendBuckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recentHits.length >= maxHits) {
    sendBuckets.set(key, recentHits);
    return true;
  }

  recentHits.push(now);
  sendBuckets.set(key, recentHits);
  return false;
}

export async function GET(request: Request, context: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await context.params;
    const url = new URL(request.url);
    const after = url.searchParams.get("after");

    return NextResponse.json({
      messages: await readChatMessages(playerId, after),
    });
  } catch (error: unknown) {
    console.error("Error reading live chat:", error);
    return NextResponse.json({ error: "Failed to read chat" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await context.params;
    const payload = await request.json();
    const kind = payload.kind === "reaction" ? "reaction" : "message";

    if (isRateLimited(getRequesterKey(request, playerId, payload.author), kind)) {
      return NextResponse.json(
        { error: kind === "reaction" ? "Slow down reactions." : "Slow down chat messages." },
        { status: 429 }
      );
    }

    const moderation = await moderateChatMessage({
      body: typeof payload.body === "string" ? payload.body : "",
      kind,
    });

    if (!moderation.allowed) {
      return NextResponse.json(
        { error: moderation.reason, moderation },
        { status: 400 }
      );
    }

    const message = await createChatMessage(playerId, payload);

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        clientId: normalizeClientId(payload.clientId),
      },
    });
  } catch (error: unknown) {
    console.error("Error saving live chat:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 400 });
  }
}
