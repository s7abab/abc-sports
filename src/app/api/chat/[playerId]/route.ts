import { NextResponse } from "next/server";

import { createChatMessage, readChatMessages } from "@/lib/chat-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await context.params;
    const url = new URL(request.url);
    const after = url.searchParams.get("after");

    return NextResponse.json({
      messages: readChatMessages(playerId, after),
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
    const message = createChatMessage(playerId, payload);

    return NextResponse.json({ success: true, message });
  } catch (error: unknown) {
    console.error("Error saving live chat:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 400 });
  }
}
