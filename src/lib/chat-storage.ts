import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";

export type ChatMessageKind = "message" | "reaction";

export interface ChatMessage {
  id: string;
  playerId: string;
  author: string;
  body: string;
  kind: ChatMessageKind;
  createdAt: string;
}

interface ChatMessageRow {
  id: string;
  playerId: string;
  author: string;
  body: string;
  kind: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "chat.sqlite");
const MAX_BODY_LENGTH = 280;
const MAX_AUTHOR_LENGTH = 28;
const MAX_ROOM_MESSAGES = 400;

let databaseInitialized = false;
let sqliteAvailable: boolean | null = null;

const memoryStore = globalThis as typeof globalThis & {
  __abcSportsChatMessages?: ChatMessage[];
};

function canUseSqlite() {
  if (sqliteAvailable !== null) {
    return sqliteAvailable;
  }

  try {
    execFileSync("sqlite3", ["-version"], { stdio: "ignore" });
    sqliteAvailable = true;
  } catch {
    sqliteAvailable = false;
  }

  return sqliteAvailable;
}

function ensureMemoryStore() {
  memoryStore.__abcSportsChatMessages ??= [];
}

function ensureDatabase() {
  if (databaseInitialized) {
    return;
  }

  if (!canUseSqlite()) {
    ensureMemoryStore();
    databaseInitialized = true;
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  runSqlite(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'message',
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx
      ON chat_messages (playerId, createdAt);
  `);

  databaseInitialized = true;
}

function runSqlite(sql: string): string {
  return execFileSync("sqlite3", ["-batch", "-json", DB_PATH], {
    input: sql,
    encoding: "utf8",
  });
}

function querySqlite<T>(sql: string): T[] {
  const output = runSqlite(sql).trim();
  if (!output) {
    return [];
  }

  return JSON.parse(output) as T[];
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

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

function mapRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    playerId: row.playerId,
    author: row.author,
    body: row.body,
    kind: normalizeKind(row.kind),
    createdAt: row.createdAt,
  };
}

function pruneRoom(playerId: string) {
  if (!canUseSqlite()) {
    ensureMemoryStore();
    const messages = memoryStore.__abcSportsChatMessages ?? [];
    const roomMessages = messages
      .filter((message) => message.playerId === playerId)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
      .slice(0, MAX_ROOM_MESSAGES);
    const keepIds = new Set(roomMessages.map((message) => message.id));
    memoryStore.__abcSportsChatMessages = messages.filter(
      (message) => message.playerId !== playerId || keepIds.has(message.id)
    );
    return;
  }

  runSqlite(`
    DELETE FROM chat_messages
    WHERE playerId = ${sqlString(playerId)}
      AND id NOT IN (
        SELECT id FROM chat_messages
        WHERE playerId = ${sqlString(playerId)}
        ORDER BY createdAt DESC
        LIMIT ${MAX_ROOM_MESSAGES}
      );
  `);
}

export function readChatMessages(playerId: string, after?: string | null): ChatMessage[] {
  ensureDatabase();

  const trimmedPlayerId = playerId.trim();
  if (!trimmedPlayerId) {
    return [];
  }

  if (!canUseSqlite()) {
    ensureMemoryStore();
    const afterTime = after ? new Date(after).getTime() : 0;
    return (memoryStore.__abcSportsChatMessages ?? [])
      .filter((message) => {
        if (message.playerId !== trimmedPlayerId) {
          return false;
        }

        return afterTime ? new Date(message.createdAt).getTime() > afterTime : true;
      })
      .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
      .slice(0, 100);
  }

  const afterClause = after ? `AND createdAt > ${sqlString(after)}` : "";
  const rows = querySqlite<ChatMessageRow>(`
    SELECT id, playerId, author, body, kind, createdAt
    FROM chat_messages
    WHERE playerId = ${sqlString(trimmedPlayerId)}
      ${afterClause}
    ORDER BY createdAt ASC
    LIMIT 100;
  `);

  return rows.map(mapRow);
}

export function createChatMessage(
  playerId: string,
  input: { author?: unknown; body?: unknown; kind?: unknown }
): ChatMessage {
  ensureDatabase();

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

  if (!canUseSqlite()) {
    ensureMemoryStore();
    memoryStore.__abcSportsChatMessages = [...(memoryStore.__abcSportsChatMessages ?? []), message];
    pruneRoom(trimmedPlayerId);
    return message;
  }

  runSqlite(`
    INSERT INTO chat_messages (id, playerId, author, body, kind, createdAt)
    VALUES (
      ${sqlString(message.id)},
      ${sqlString(message.playerId)},
      ${sqlString(message.author)},
      ${sqlString(message.body)},
      ${sqlString(message.kind)},
      ${sqlString(message.createdAt)}
    );
  `);
  pruneRoom(trimmedPlayerId);

  return message;
}
