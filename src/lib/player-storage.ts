import fs from "fs";
import path from "path";

import type { Json } from "@/lib/supabase-storage";
import { getSupabaseStorageClient } from "@/lib/supabase-storage";

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

const SEED_PATH = path.join(process.cwd(), "data", "players.json");

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

function toPlayerRow(player: PlayerConfig, position: number) {
  return {
    id: player.id,
    position,
    name: player.name,
    primary_server: player.primaryServer,
    servers: JSON.parse(JSON.stringify(player.servers)) as Json,
  };
}

async function seedPlayersIfEmpty() {
  const supabase = getSupabaseStorageClient();
  const { count, error } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  if (count === 0) {
    const seedPlayers = loadSeedPlayers();
    if (seedPlayers.length > 0) {
      const { error: insertError } = await supabase
        .from("players")
        .insert(seedPlayers.map(toPlayerRow));

      if (insertError) {
        throw insertError;
      }
    }
  }
}

export async function readPlayers(): Promise<PlayerConfig[]> {
  await seedPlayersIfEmpty();
  const { data, error } = await getSupabaseStorageClient()
    .from("players")
    .select("id, name, primary_server, servers")
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const servers =
      row.servers && typeof row.servers === "object" && !Array.isArray(row.servers)
        ? (row.servers as Partial<Record<ServerSlot, unknown>>)
        : {};

    return {
    id: row.id,
    name: row.name,
    primaryServer: row.primary_server,
    servers: {
      "1": normalizeServer(servers["1"]),
      "2": normalizeServer(servers["2"]),
      "3": normalizeServer(servers["3"]),
      "4": normalizeServer(servers["4"]),
    },
    };
  });
}

export async function savePlayers(input: unknown): Promise<PlayerConfig[]> {
  if (!Array.isArray(input)) {
    throw new Error("Invalid data format. Expected an array.");
  }

  const players = input
    .map((player, position) => normalizePlayer(player, position))
    .filter((player): player is PlayerConfig => Boolean(player));

  const supabase = getSupabaseStorageClient();
  const { error: deleteError } = await supabase.from("players").delete().neq("id", "");
  if (deleteError) {
    throw deleteError;
  }

  if (players.length > 0) {
    const { error: insertError } = await supabase
      .from("players")
      .insert(players.map(toPlayerRow));

    if (insertError) {
      throw insertError;
    }
  }

  return players;
}
