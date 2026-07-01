import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";

import {
  deriveMatchStatus,
  type MatchStatus,
  normalizeMatchDateTime,
} from "@/lib/match-utils";

export interface MatchConfig {
  id: string;
  live: boolean;
  status: MatchStatus;
  competition: string;
  date: string;
  home: string;
  away: string;
  playerId: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
}

interface MatchRow {
  id: string;
  position: number;
  live: number;
  status: string | null;
  competition: string;
  date: string;
  home: string;
  away: string;
  playerId: string;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "matches.sqlite");

const DEFAULT_MATCHES: MatchConfig[] = [
  {
    id: "match-portugal-brazil",
    live: true,
    status: "today",
    competition: "FIFA World Cup 2026",
    date: "2026-06-30",
    home: "Portugal",
    away: "Brazil",
    playerId: "1",
    homeLogoUrl: "",
    awayLogoUrl: "",
  },
  {
    id: "match-france-japan",
    live: false,
    status: "upcoming",
    competition: "FIFA World Cup 2026",
    date: "2026-06-30",
    home: "France",
    away: "Japan",
    playerId: "2",
    homeLogoUrl: "",
    awayLogoUrl: "",
  },
  {
    id: "match-spain-england",
    live: true,
    status: "today",
    competition: "FIFA World Cup 2026",
    date: "2026-07-01",
    home: "Spain",
    away: "England",
    playerId: "3",
    homeLogoUrl: "",
    awayLogoUrl: "",
  },
  {
    id: "match-germany-italy",
    live: false,
    status: "upcoming",
    competition: "FIFA World Cup 2026",
    date: "2026-07-01",
    home: "Germany",
    away: "Italy",
    playerId: "4",
    homeLogoUrl: "",
    awayLogoUrl: "",
  },
];

let databaseInitialized = false;
let sqliteAvailable: boolean | null = null;

const memoryStore = globalThis as typeof globalThis & {
  __abcSportsMatches?: MatchConfig[];
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
  if (!memoryStore.__abcSportsMatches) {
    memoryStore.__abcSportsMatches = DEFAULT_MATCHES.map((match) => ({ ...match }));
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
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL,
      live INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      competition TEXT NOT NULL,
      date TEXT NOT NULL,
      home TEXT NOT NULL,
      away TEXT NOT NULL,
      playerId TEXT NOT NULL DEFAULT '1',
      homeLogoUrl TEXT NOT NULL DEFAULT '',
      awayLogoUrl TEXT NOT NULL DEFAULT ''
    );
  `);

  const columns = querySqlite<{ name: string }>("PRAGMA table_info(matches);");
  if (!columns.some((column) => column.name === "status")) {
    runSqlite("ALTER TABLE matches ADD COLUMN status TEXT NOT NULL DEFAULT 'upcoming';");
  }
  if (!columns.some((column) => column.name === "homeLogoUrl")) {
    runSqlite("ALTER TABLE matches ADD COLUMN homeLogoUrl TEXT NOT NULL DEFAULT '';");
  }
  if (!columns.some((column) => column.name === "awayLogoUrl")) {
    runSqlite("ALTER TABLE matches ADD COLUMN awayLogoUrl TEXT NOT NULL DEFAULT '';");
  }
  if (!columns.some((column) => column.name === "playerId")) {
    runSqlite("ALTER TABLE matches ADD COLUMN playerId TEXT NOT NULL DEFAULT '1';");
  }

  const existingCount = querySqlite<{ count: number }>("SELECT COUNT(*) AS count FROM matches;");
  if (existingCount.length === 0 || existingCount[0].count === 0) {
    replaceMatches(DEFAULT_MATCHES);
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

function normalizeMatch(value: unknown): MatchConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const match = value as Partial<MatchConfig>;
  const competition = typeof match.competition === "string" ? match.competition.trim() : "";
  const date = typeof match.date === "string" ? match.date.trim() : "";
  const home = typeof match.home === "string" ? match.home.trim() : "";
  const away = typeof match.away === "string" ? match.away.trim() : "";
  const playerId = typeof match.playerId === "string" ? match.playerId.trim() : "1";
  const homeLogoUrl = typeof match.homeLogoUrl === "string" ? match.homeLogoUrl.trim() : "";
  const awayLogoUrl = typeof match.awayLogoUrl === "string" ? match.awayLogoUrl.trim() : "";

  if (!competition || !date || !home || !away) {
    return null;
  }

  const normalizedDate = normalizeMatchDateTime(date);

  return {
    id: typeof match.id === "string" && match.id.trim() ? match.id : randomUUID(),
    live: Boolean(match.live),
    status: deriveMatchStatus(normalizedDate),
    competition,
    date: normalizedDate,
    home,
    away,
    playerId: playerId || "1",
    homeLogoUrl,
    awayLogoUrl,
  };
}

function replaceMatches(matches: MatchConfig[]) {
  if (!canUseSqlite()) {
    memoryStore.__abcSportsMatches = matches.map((match) => ({ ...match }));
    return;
  }

  const statements = [
    "BEGIN TRANSACTION;",
    "DELETE FROM matches;",
    ...matches.map(
      (match, position) => `
        INSERT INTO matches (id, position, live, status, competition, date, home, away, playerId, homeLogoUrl, awayLogoUrl)
        VALUES (
          ${sqlString(match.id)},
          ${position},
          ${match.live ? 1 : 0},
          ${sqlString(match.status)},
          ${sqlString(match.competition)},
          ${sqlString(match.date)},
          ${sqlString(match.home)},
          ${sqlString(match.away)},
          ${sqlString(match.playerId)},
          ${sqlString(match.homeLogoUrl)},
          ${sqlString(match.awayLogoUrl)}
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

export function readMatches(): MatchConfig[] {
  ensureDatabase();

  if (!canUseSqlite()) {
    ensureMemoryStore();
    return (memoryStore.__abcSportsMatches ?? []).map((match) => ({
      ...match,
      status: deriveMatchStatus(match.date),
    }));
  }

  const rows = querySqlite<MatchRow>(
    "SELECT id, position, live, status, competition, date, home, away, playerId, homeLogoUrl, awayLogoUrl FROM matches ORDER BY position ASC;"
  );

  return rows.map((row) => ({
    id: row.id,
    live: row.live === 1,
    status: deriveMatchStatus(row.date),
    competition: row.competition,
    date: row.date,
    home: row.home,
    away: row.away,
    playerId: row.playerId || "1",
    homeLogoUrl: row.homeLogoUrl ?? "",
    awayLogoUrl: row.awayLogoUrl ?? "",
  }));
}

export function readMatch(id: string): MatchConfig | null {
  return readMatches().find((match) => match.id === id) ?? null;
}

export function saveMatches(input: unknown): MatchConfig[] {
  ensureDatabase();

  if (!Array.isArray(input)) {
    throw new Error("Invalid data format. Expected an array.");
  }

  const matches = input
    .map((match) => normalizeMatch(match))
    .filter((match): match is MatchConfig => Boolean(match));

  replaceMatches(matches);
  return matches;
}

export function createMatch(input: unknown): MatchConfig {
  ensureDatabase();

  const match = normalizeMatch(input);
  if (!match) {
    throw new Error("Invalid match payload.");
  }

  const matches = readMatches();
  const nextMatches = [...matches, match];
  replaceMatches(nextMatches);
  return match;
}

export function updateMatch(id: string, input: unknown): MatchConfig {
  ensureDatabase();

  const existingMatches = readMatches();
  const current = existingMatches.find((match) => match.id === id);
  if (!current) {
    throw new Error("Match not found.");
  }

  const match = normalizeMatch({ ...current, ...(input as Record<string, unknown>), id });
  if (!match) {
    throw new Error("Invalid match payload.");
  }

  const nextMatches = existingMatches.map((item) => (item.id === id ? match : item));
  replaceMatches(nextMatches);
  return match;
}

export function deleteMatch(id: string): void {
  ensureDatabase();
  const nextMatches = readMatches().filter((match) => match.id !== id);
  replaceMatches(nextMatches);
}
