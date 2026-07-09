"use client";

export type QueuedMutation = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  createdAt: string;
};

const QUEUE_KEY = "abc-sports-offline-mutation-queue";

function readQueue(): QueuedMutation[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("abc-sports-queue-change", { detail: queue.length }));
}

function getHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

function canQueue(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase();
  return url.startsWith("/api/") && method !== "GET";
}

function queueMutation(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init.body : undefined;
  const queue = readQueue();

  const mutation: QueuedMutation = {
    id: crypto.randomUUID(),
    url,
    method,
    headers: getHeaderRecord(init?.headers),
    body,
    createdAt: new Date().toISOString(),
  };

  writeQueue([...queue, mutation]);
  return mutation;
}

export function getQueuedMutationCount() {
  if (typeof window === "undefined") return 0;
  return readQueue().length;
}

export async function queuedFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!canQueue(input, init)) {
      throw error;
    }

    const mutation = queueMutation(input, init);
    return Response.json(
      {
        queued: true,
        id: mutation.id,
        message: "Saved offline. This change will sync when the connection returns.",
      },
      { status: 202 }
    );
  }
}

export async function flushQueuedMutations() {
  const queue = readQueue();
  if (queue.length === 0 || !window.navigator.onLine) return { flushed: 0, remaining: queue.length };

  const remaining: QueuedMutation[] = [];
  let flushed = 0;

  for (const mutation of queue) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      });

      if (response.ok) {
        flushed += 1;
      } else {
        remaining.push(mutation);
      }
    } catch {
      remaining.push(mutation);
    }
  }

  writeQueue(remaining);
  return { flushed, remaining: remaining.length };
}
