import { createServer } from "http";
import { execFileSync } from "child_process";
import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "chat.sqlite");
const CHAT_SOCKET_PATH = "/api/chat/socket";
const MAX_BODY_LENGTH = 280;
const MAX_AUTHOR_LENGTH = 28;
const MAX_ROOM_MESSAGES = 400;

const rooms = new Map();

function runSqlite(sql) {
  return execFileSync("sqlite3", ["-batch", "-json", DB_PATH], {
    input: sql,
    encoding: "utf8",
  });
}

function querySqlite(sql) {
  const output = runSqlite(sql).trim();
  return output ? JSON.parse(output) : [];
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureChatDatabase() {
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

function pruneRoom(playerId) {
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

function createChatMessage(playerId, input) {
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
  pruneRoom(playerId);

  return message;
}

function readRecentMessages(playerId) {
  return querySqlite(`
    SELECT id, playerId, author, body, kind, createdAt
    FROM chat_messages
    WHERE playerId = ${sqlString(playerId)}
    ORDER BY createdAt DESC
    LIMIT 60;
  `).reverse();
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

function handleChatUpgrade(req, socket) {
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

  sendJson(socket, {
    type: "history",
    messages: readRecentMessages(playerId),
  });

  socket.on("data", (chunk) => {
    for (const rawMessage of decodeFrames(socket, chunk)) {
      try {
        const payload = JSON.parse(rawMessage);
        if (payload.type !== "message") {
          continue;
        }

        const message = createChatMessage(playerId, payload);
        if (message) {
          broadcast(playerId, { type: "message", message });
        }
      } catch {
        sendJson(socket, { type: "error", error: "Invalid chat payload." });
      }
    }
  });

  socket.on("close", () => removeSocket(socket));
  socket.on("end", () => removeSocket(socket));
  socket.on("error", () => removeSocket(socket));
}

ensureChatDatabase();

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
      handleChatUpgrade(req, socket);
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Server listening at http://${hostname}:${port} as ${dev ? "development" : "production"}`);
  });
});
