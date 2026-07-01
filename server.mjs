import { createServer } from "http";
import { randomUUID, createHash } from "crypto";
import next from "next";
import { createClient } from "@supabase/supabase-js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const CHAT_SOCKET_PATH = "/api/chat/socket";
const MAX_BODY_LENGTH = 280;
const MAX_AUTHOR_LENGTH = 28;
const MAX_ROOM_MESSAGES = 400;

const rooms = new Map();
let supabase = null;

function getSupabaseStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabase;
}

function normalizeAuthor(value) {
  if (typeof value !== "string") {
    return "Fan";
  }

  const author = value.replace(/\s+/g, " ").trim().slice(0, MAX_AUTHOR_LENGTH);
  return author || "Fan";
}

function normalizeBody(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_LENGTH);
}

function normalizeKind(value) {
  return value === "reaction" ? "reaction" : "message";
}

async function pruneRoom(playerId) {
  const { data, error } = await getSupabaseStorageClient()
    .from("chat_messages")
    .select("id")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .range(MAX_ROOM_MESSAGES, MAX_ROOM_MESSAGES + 100);

  if (error) {
    throw error;
  }

  const oldIds = (data ?? []).map((item) => item.id);
  if (oldIds.length > 0) {
    const { error: deleteError } = await getSupabaseStorageClient()
      .from("chat_messages")
      .delete()
      .in("id", oldIds);

    if (deleteError) {
      throw deleteError;
    }
  }
}

async function createChatMessage(playerId, input) {
  const body = normalizeBody(input.body);
  if (!playerId || !body) {
    return null;
  }

  const message = {
    id: randomUUID(),
    playerId,
    author: normalizeAuthor(input.author),
    body,
    kind: normalizeKind(input.kind),
    createdAt: new Date().toISOString(),
  };

  const { error } = await getSupabaseStorageClient().from("chat_messages").insert({
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

  await pruneRoom(playerId);

  return message;
}

async function readRecentMessages(playerId) {
  const { data, error } = await getSupabaseStorageClient()
    .from("chat_messages")
    .select("id, player_id, author, body, kind, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    throw error;
  }

  return (data ?? []).reverse().map((row) => ({
    id: row.id,
    playerId: row.player_id,
    author: row.author,
    body: row.body,
    kind: normalizeKind(row.kind),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

function encodeFrame(payload) {
  const data = Buffer.from(payload);
  const length = data.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), data]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, data]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, data]);
}

function decodeFrames(socket, chunk) {
  socket.wsBuffer = socket.wsBuffer ? Buffer.concat([socket.wsBuffer, chunk]) : chunk;
  const messages = [];

  while (socket.wsBuffer.length >= 2) {
    const firstByte = socket.wsBuffer[0];
    const secondByte = socket.wsBuffer[1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let length = secondByte & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (socket.wsBuffer.length < offset + 2) break;
      length = socket.wsBuffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (socket.wsBuffer.length < offset + 8) break;
      length = Number(socket.wsBuffer.readBigUInt64BE(offset));
      offset += 8;
    }

    const maskOffset = masked ? 4 : 0;
    const frameLength = offset + maskOffset + length;
    if (socket.wsBuffer.length < frameLength) break;

    let payload = socket.wsBuffer.subarray(offset + maskOffset, frameLength);
    if (masked) {
      const mask = socket.wsBuffer.subarray(offset, offset + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }

    socket.wsBuffer = socket.wsBuffer.subarray(frameLength);

    if (opcode === 0x8) {
      socket.end();
      continue;
    }

    if (opcode === 0x1) {
      messages.push(payload.toString("utf8"));
    }
  }

  return messages;
}

function sendJson(socket, payload) {
  if (!socket.destroyed) {
    socket.write(encodeFrame(JSON.stringify(payload)));
  }
}

function broadcast(playerId, payload) {
  const room = rooms.get(playerId);
  if (!room) {
    return;
  }

  for (const socket of room) {
    sendJson(socket, payload);
  }
}

function removeSocket(socket) {
  if (!socket.playerId) {
    return;
  }

  const room = rooms.get(socket.playerId);
  if (!room) {
    return;
  }

  room.delete(socket);
  if (room.size === 0) {
    rooms.delete(socket.playerId);
  }
}

async function handleChatUpgrade(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const playerId = requestUrl.searchParams.get("playerId")?.trim();
  if (!playerId) {
    socket.destroy();
    return;
  }

  const acceptKey = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n")
  );

  socket.playerId = playerId;
  if (!rooms.has(playerId)) {
    rooms.set(playerId, new Set());
  }
  rooms.get(playerId).add(socket);

  try {
    sendJson(socket, {
      type: "history",
      messages: await readRecentMessages(playerId),
    });
  } catch {
    sendJson(socket, { type: "error", error: "Chat history is unavailable." });
  }

  socket.on("data", async (chunk) => {
    for (const rawMessage of decodeFrames(socket, chunk)) {
      try {
        const payload = JSON.parse(rawMessage);
        if (payload.type !== "message") {
          continue;
        }

        const message = await createChatMessage(playerId, payload);
        if (message) {
          broadcast(playerId, { type: "message", message });
        }
      } catch {
        sendJson(socket, { type: "error", error: "Message not sent." });
      }
    }
  });

  socket.on("close", () => removeSocket(socket));
  socket.on("end", () => removeSocket(socket));
  socket.on("error", () => removeSocket(socket));
}

const server = createServer();
const app = next({ dev, hostname, port, httpServer: server });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  server.on("request", (req, res) => {
    handle(req, res);
  });

  server.on("upgrade", (req, socket) => {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (requestUrl.pathname === CHAT_SOCKET_PATH) {
      handleChatUpgrade(req, socket).catch(() => socket.destroy());
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Server listening at http://${hostname}:${port} as ${dev ? "development" : "production"}`);
  });
});
