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
  servers: Record<string, PlayerServer>;
}

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

function normalizeServers(value: unknown): Record<string, PlayerServer> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      "1": createEmptyServer(),
      "2": createEmptyServer(),
      "3": createEmptyServer(),
      "4": createEmptyServer(),
    };
  }

  const input = value as Record<string, unknown>;
  const normalized = Object.entries(input).reduce<Record<string, PlayerServer>>(
    (servers, [slot, server]) => {
      const id = slot.trim();
      if (!id) return servers;
      servers[id] = normalizeServer(server);
      return servers;
    },
    {}
  );

  if (Object.keys(normalized).length === 0) {
    return {
      "1": createEmptyServer(),
      "2": createEmptyServer(),
      "3": createEmptyServer(),
      "4": createEmptyServer(),
    };
  }

  return normalized;
}

function normalizePlayer(value: unknown, position = 0): PlayerConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const player = value as Partial<PlayerConfig> & { servers?: unknown };
  if (typeof player.id !== "string") {
    return null;
  }

  const servers = normalizeServers(player.servers);
  const firstServerId = Object.keys(servers)[0] ?? "1";

  return {
    id: player.id,
    name: typeof player.name === "string" ? player.name : `Player ${position + 1}`,
    primaryServer:
      typeof player.primaryServer === "string" && servers[player.primaryServer]
        ? player.primaryServer
        : firstServerId,
    servers,
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
    const servers = normalizeServers(row.servers);
    const firstServerId = Object.keys(servers)[0] ?? "1";

    return {
    id: row.id,
    name: row.name,
    primaryServer: servers[row.primary_server] ? row.primary_server : firstServerId,
    servers,
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

  const { data: existingPlayers, error: existingError } = await supabase
    .from("players")
    .select("id");

  if (existingError) {
    throw existingError;
  }

  const existingIds = new Set((existingPlayers ?? []).map((row) => row.id));
  const nextIds = new Set(players.map((player) => player.id));
  const removedIds = [...existingIds].filter((id) => !nextIds.has(id));

  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase.from("players").delete().in("id", removedIds);
    if (deleteError) {
      throw deleteError;
    }
  }

  if (players.length > 0) {
    const { error: upsertError } = await supabase
      .from("players")
      .upsert(players.map(toPlayerRow), { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }
  }

  return players;
}
