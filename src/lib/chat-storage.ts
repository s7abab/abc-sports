import { randomUUID } from "crypto";

import { getSupabaseStorageClient } from "@/lib/supabase-storage";

export type ChatMessageKind = "message" | "reaction";

export interface ChatMessage {
  id: string;
  playerId: string;
  author: string;
  body: string;
  kind: ChatMessageKind;
  createdAt: string;
}

const MAX_BODY_LENGTH = 280;
const MAX_AUTHOR_LENGTH = 28;
const MAX_ROOM_MESSAGES = 400;

function normalizeKind(value: unknown): ChatMessageKind {
  return value === "reaction" ? "reaction" : "message";
}

function normalizeAuthor(value: unknown): string {
  if (typeof value !== "string") {
    return "Fan";
  }

  const author = value.replace(/\s+/g, " ").trim().slice(0, MAX_AUTHOR_LENGTH);
  return author || "Fan";
}

function normalizeBody(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_LENGTH);
}

export async function readChatMessages(playerId: string, after?: string | null): Promise<ChatMessage[]> {
  const trimmedPlayerId = playerId.trim();
  if (!trimmedPlayerId) {
    return [];
  }

  let query = getSupabaseStorageClient()
    .from("chat_messages")
    .select("id, player_id, author, body, kind, created_at")
    .eq("player_id", trimmedPlayerId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (after) {
    query = query.gt("created_at", after);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    playerId: row.player_id,
    author: row.author,
    body: row.body,
    kind: normalizeKind(row.kind),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function createChatMessage(
  playerId: string,
  input: { author?: unknown; body?: unknown; kind?: unknown }
): Promise<ChatMessage> {
  const trimmedPlayerId = playerId.trim();
  const body = normalizeBody(input.body);

  if (!trimmedPlayerId) {
    throw new Error("Player room is required.");
  }

  if (!body) {
    throw new Error("Message is required.");
  }

  const message: ChatMessage = {
    id: randomUUID(),
    playerId: trimmedPlayerId,
    author: normalizeAuthor(input.author),
    body,
    kind: normalizeKind(input.kind),
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabaseStorageClient();
  const { error } = await supabase.from("chat_messages").insert({
    id: message.id,
    player_id: message.playerId,
    author: message.author,
    body: message.body,
    kind: message.kind,
    created_at: message.createdAt,
  });

  if (error) {
    throw error;
  }

  const { data: oldMessages, error: oldMessagesError } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("player_id", trimmedPlayerId)
    .order("created_at", { ascending: false })
    .range(MAX_ROOM_MESSAGES, MAX_ROOM_MESSAGES + 100);

  if (oldMessagesError) {
    throw oldMessagesError;
  }

  const oldIds = (oldMessages ?? []).map((item) => item.id);
  if (oldIds.length > 0) {
    const { error: pruneError } = await supabase
      .from("chat_messages")
      .delete()
      .in("id", oldIds);

    if (pruneError) {
      throw pruneError;
    }
  }

  return message;
}
