import { NextResponse } from "next/server";

import {
  addStreamHealthEvent,
  buildStreamHealthAlerts,
  getRecentStreamHealthEvents,
  summarizeStreamHealth,
  type StreamHealthEventType,
} from "@/lib/stream-health-events";

const EVENT_TYPES = new Set<StreamHealthEventType>([
  "server_failed",
  "server_switch",
  "stream_recovered",
]);

export async function GET() {
  const events = getRecentStreamHealthEvents();
  return NextResponse.json({
    events,
    alerts: buildStreamHealthAlerts(events),
    summary: await summarizeStreamHealth(),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const type = typeof payload.type === "string" ? payload.type : "";
    const playerId = typeof payload.playerId === "string" ? payload.playerId.trim() : "";
    const serverId = typeof payload.serverId === "string" ? payload.serverId.trim() : "";

    if (!EVENT_TYPES.has(type as StreamHealthEventType) || !playerId || !serverId) {
      return NextResponse.json({ error: "Invalid stream health event." }, { status: 400 });
    }

    const event = addStreamHealthEvent({
      type: type as StreamHealthEventType,
      playerId,
      serverId,
      serverName: typeof payload.serverName === "string" ? payload.serverName : undefined,
      targetServerId: typeof payload.targetServerId === "string" ? payload.targetServerId : undefined,
      targetServerName: typeof payload.targetServerName === "string" ? payload.targetServerName : undefined,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    });

    if (!event) {
      return NextResponse.json({ success: true, deduped: true });
    }

    return NextResponse.json({ success: true, event });
  } catch {
    return NextResponse.json({ error: "Failed to record stream health event." }, { status: 400 });
  }
}
