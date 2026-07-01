import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

export interface PlayerServer {
  name: string;
  url: string;
}

export interface PlayerConfig {
  id: string;
  name: string;
  primaryServer: string;
  servers: {
    "1": PlayerServer;
    "2": PlayerServer;
    "3": PlayerServer;
    "4": PlayerServer;
  };
}

type ServerSlot = "1" | "2" | "3" | "4";

interface PlayerRow {
  id: string;
  position: number;
  name: string;
  primaryServer: string;
  servers: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "players.sqlite");
const SEED_PATH = path.join(DATA_DIR, "players.json");

let databaseInitialized = false;
let sqliteAvailable: boolean | null = null;

const memoryStore = globalThis as typeof globalThis & {
  __abcSportsPlayers?: PlayerConfig[];
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

function clonePlayers(players: PlayerConfig[]) {
  return players.map((player) => ({
    ...player,
    servers: {
      "1": { ...player.servers["1"] },
      "2": { ...player.servers["2"] },
      "3": { ...player.servers["3"] },
      "4": { ...player.servers["4"] },
    },
  }));
}

function ensureMemoryStore() {
  if (!memoryStore.__abcSportsPlayers) {
    memoryStore.__abcSportsPlayers = clonePlayers(loadSeedPlayers());
  }
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
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      primaryServer TEXT NOT NULL,
      servers TEXT NOT NULL
    );
  `);

  const existingCount = querySqlite<{ count: number }>("SELECT COUNT(*) AS count FROM players;");
  if (existingCount.length === 0 || existingCount[0].count === 0) {
    const seedPlayers = loadSeedPlayers();
    if (seedPlayers.length > 0) {
      replacePlayers(seedPlayers);
    }
  }

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

function loadSeedPlayers(): PlayerConfig[] {
  if (!fs.existsSync(SEED_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(SEED_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizePlayer).filter((player): player is PlayerConfig => Boolean(player));
  } catch (error) {
    console.error("Failed to load seed players from JSON:", error);
    return [];
  }
}

function createEmptyServer(): PlayerServer {
  return { name: "", url: "" };
}

function normalizeServer(value: unknown): PlayerServer {
  if (!value || typeof value !== "object") {
    return createEmptyServer();
  }

  const server = value as Partial<PlayerServer>;
  return {
    name: typeof server.name === "string" ? server.name : "",
    url: typeof server.url === "string" ? server.url : "",
  };
}

function normalizePlayer(value: unknown, position = 0): PlayerConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const player = value as Partial<PlayerConfig> & { servers?: Partial<Record<ServerSlot, unknown>> };
  if (typeof player.id !== "string") {
    return null;
  }

  const servers: Partial<Record<ServerSlot, unknown>> = player.servers ?? {};

  return {
    id: player.id,
    name: typeof player.name === "string" ? player.name : `Player ${position + 1}`,
    primaryServer: typeof player.primaryServer === "string" ? player.primaryServer : "1",
    servers: {
      "1": normalizeServer(servers["1"]),
      "2": normalizeServer(servers["2"]),
      "3": normalizeServer(servers["3"]),
      "4": normalizeServer(servers["4"]),
    },
  };
}

function replacePlayers(players: PlayerConfig[]) {
  if (!canUseSqlite()) {
    memoryStore.__abcSportsPlayers = clonePlayers(players);
    return;
  }

  const statements = [
    "BEGIN TRANSACTION;",
    "DELETE FROM players;",
    ...players.map(
      (player, position) => `
        INSERT INTO players (id, position, name, primaryServer, servers)
        VALUES (
          ${sqlString(player.id)},
          ${position},
          ${sqlString(player.name)},
          ${sqlString(player.primaryServer)},
          ${sqlString(JSON.stringify(player.servers))}
        );
      `
    ),
    "COMMIT;",
  ];

  try {
    runSqlite(statements.join("\n"));
  } catch (error) {
    try {
      runSqlite("ROLLBACK;");
    } catch {
      // Ignore rollback errors; the original error is the important one.
    }
    throw error;
  }
}

export function readPlayers(): PlayerConfig[] {
  ensureDatabase();

  if (!canUseSqlite()) {
    ensureMemoryStore();
    return clonePlayers(memoryStore.__abcSportsPlayers ?? []);
  }

  const rows = querySqlite<PlayerRow>(
    "SELECT id, position, name, primaryServer, servers FROM players ORDER BY position ASC;"
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    primaryServer: row.primaryServer,
    servers: normalizeServerMap(row.servers),
  }));
}

export function savePlayers(input: unknown): PlayerConfig[] {
  ensureDatabase();

  if (!Array.isArray(input)) {
    throw new Error("Invalid data format. Expected an array.");
  }

  const players = input
    .map((player, position) => normalizePlayer(player, position))
    .filter((player): player is PlayerConfig => Boolean(player));

  replacePlayers(players);
  return players;
}

function normalizeServerMap(value: string): PlayerConfig["servers"] {
  try {
    const parsed = JSON.parse(value) as Partial<Record<ServerSlot, unknown>>;
    return {
      "1": normalizeServer(parsed["1"]),
      "2": normalizeServer(parsed["2"]),
      "3": normalizeServer(parsed["3"]),
      "4": normalizeServer(parsed["4"]),
    };
  } catch {
    return {
      "1": createEmptyServer(),
      "2": createEmptyServer(),
      "3": createEmptyServer(),
      "4": createEmptyServer(),
    };
  }
}
