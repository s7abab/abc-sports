import { createOpenRouterChatCompletion, isAiEnabled } from "@/lib/openrouter";

export type StreamHealthEventType = "server_failed" | "server_switch" | "stream_recovered";

export interface StreamHealthEvent {
  id: string;
  type: StreamHealthEventType;
  playerId: string;
  serverId: string;
  serverName?: string;
  targetServerId?: string;
  targetServerName?: string;
  reason?: string;
  createdAt: string;
}

export interface StreamHealthAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  playerId: string;
  serverId?: string;
  createdAt: string;
}

const MAX_EVENTS = 300;
const events: StreamHealthEvent[] = [];
const lastEventByKey = new Map<string, number>();
let cachedSummary: { createdAt: number; text: string } | null = null;

export function addStreamHealthEvent(input: Omit<StreamHealthEvent, "id" | "createdAt">) {
  const key = [
    input.type,
    input.playerId,
    input.serverId,
    input.targetServerId ?? "",
    input.reason ?? "",
  ].join(":");
  const now = Date.now();
  const cooldownMs =
    input.type === "server_failed"
      ? 60_000
      : input.type === "server_switch"
      ? 15_000
      : 30_000;
  const lastAt = lastEventByKey.get(key) ?? 0;

  if (now - lastAt < cooldownMs) {
    return null;
  }

  lastEventByKey.set(key, now);

  const event: StreamHealthEvent = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  events.unshift(event);
  events.splice(MAX_EVENTS);
  cachedSummary = null;
  return event;
}

export function getRecentStreamHealthEvents() {
  return events.slice(0, 100);
}

export function buildStreamHealthAlerts(source = getRecentStreamHealthEvents()): StreamHealthAlert[] {
  const recentMs = 15 * 60 * 1000;
  const now = Date.now();
  const recent = source.filter((event) => now - new Date(event.createdAt).getTime() <= recentMs);
  const failedByServer = new Map<string, StreamHealthEvent[]>();

  recent
    .filter((event) => event.type === "server_failed")
    .forEach((event) => {
      const key = `${event.playerId}:${event.serverId}`;
      failedByServer.set(key, [...(failedByServer.get(key) ?? []), event]);
    });

  const alerts: StreamHealthAlert[] = [];
  failedByServer.forEach((serverEvents) => {
    const first = serverEvents[0];
    alerts.push({
      severity: serverEvents.length >= 3 ? "critical" : "warning",
      title: serverEvents.length >= 3 ? "Repeated Server Failure" : "Server Became Unstable",
      message: `${first.serverName || `Server ${first.serverId}`} failed ${serverEvents.length} time(s) in the last 15 minutes.`,
      playerId: first.playerId,
      serverId: first.serverId,
      createdAt: first.createdAt,
    });
  });

  return alerts.slice(0, 12);
}

export async function summarizeStreamHealth() {
  const recent = getRecentStreamHealthEvents().slice(0, 40);
  const alerts = buildStreamHealthAlerts(recent);

  if (recent.length === 0) {
    return "No stream health events have been reported yet.";
  }

  if (cachedSummary && Date.now() - cachedSummary.createdAt < 60_000) {
    return cachedSummary.text;
  }

  const fallback = alerts.length > 0
    ? alerts.map((alert) => `${alert.title}: ${alert.message}`).join(" ")
    : "Streams are currently stable based on recent player health reports.";

  if (!isAiEnabled()) {
    return fallback;
  }

  try {
    const text = await createOpenRouterChatCompletion({
      maxTokens: 140,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You summarize live sports stream health for an admin. Be concise. Mention unstable servers, switches, and what to check next. No markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({ events: recent, alerts }),
        },
      ],
    });

    cachedSummary = { createdAt: Date.now(), text: text || fallback };
    return cachedSummary.text;
  } catch {
    return fallback;
  }
}
