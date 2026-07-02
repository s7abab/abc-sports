import { randomUUID } from "crypto";

import {
  deriveMatchStatus,
  type MatchStatus,
  normalizeMatchDateTime,
} from "@/lib/match-utils";
import { getSupabaseStorageClient } from "@/lib/supabase-storage";

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
    status: match.status === "completed" ? "completed" : deriveMatchStatus(normalizedDate),
    competition,
    date: normalizedDate,
    home,
    away,
    playerId: playerId || "1",
    homeLogoUrl,
    awayLogoUrl,
  };
}

function toMatchRow(match: MatchConfig, position: number) {
  return {
    id: match.id,
    position,
    live: match.live,
    status: match.status,
    competition: match.competition,
    date: match.date,
    home: match.home,
    away: match.away,
    player_id: match.playerId,
    home_logo_url: match.homeLogoUrl,
    away_logo_url: match.awayLogoUrl,
  };
}

async function seedDefaultMatchesIfEmpty() {
  const supabase = getSupabaseStorageClient();
  const { count, error } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  if (count === 0) {
    const { error: insertError } = await supabase
      .from("matches")
      .insert(DEFAULT_MATCHES.map(toMatchRow));

    if (insertError) {
      throw insertError;
    }
  }
}

export async function readMatches(): Promise<MatchConfig[]> {
  await seedDefaultMatchesIfEmpty();
  const { data, error } = await getSupabaseStorageClient()
    .from("matches")
    .select("id, live, status, competition, date, home, away, player_id, home_logo_url, away_logo_url")
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    live: row.live,
    status: (row.status === "completed" ? "completed" : deriveMatchStatus(row.date)) as MatchStatus,
    competition: row.competition,
    date: row.date,
    home: row.home,
    away: row.away,
    playerId: row.player_id || "1",
    homeLogoUrl: row.home_logo_url ?? "",
    awayLogoUrl: row.away_logo_url ?? "",
  }));
}

export async function readMatch(id: string): Promise<MatchConfig | null> {
  return (await readMatches()).find((match) => match.id === id) ?? null;
}

export async function saveMatches(input: unknown): Promise<MatchConfig[]> {
  if (!Array.isArray(input)) {
    throw new Error("Invalid data format. Expected an array.");
  }

  const matches = input
    .map((match) => normalizeMatch(match))
    .filter((match): match is MatchConfig => Boolean(match));

  const supabase = getSupabaseStorageClient();
  const { error: deleteError } = await supabase.from("matches").delete().neq("id", "");
  if (deleteError) {
    throw deleteError;
  }

  if (matches.length > 0) {
    const { error: insertError } = await supabase
      .from("matches")
      .insert(matches.map(toMatchRow));

    if (insertError) {
      throw insertError;
    }
  }

  return matches;
}

export async function createMatch(input: unknown): Promise<MatchConfig> {
  const match = normalizeMatch(input);
  if (!match) {
    throw new Error("Invalid match payload.");
  }

  const matches = await readMatches();
  await saveMatches([...matches, match]);
  return match;
}

export async function updateMatch(id: string, input: unknown): Promise<MatchConfig> {
  const existingMatches = await readMatches();
  const current = existingMatches.find((match) => match.id === id);
  if (!current) {
    throw new Error("Match not found.");
  }

  const match = normalizeMatch({ ...current, ...(input as Record<string, unknown>), id });
  if (!match) {
    throw new Error("Invalid match payload.");
  }

  const nextMatches = existingMatches.map((item) => (item.id === id ? match : item));
  await saveMatches(nextMatches);
  return match;
}

export async function deleteMatch(id: string): Promise<void> {
  const nextMatches = (await readMatches()).filter((match) => match.id !== id);
  await saveMatches(nextMatches);
}
