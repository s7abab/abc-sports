"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdaptiveStreamPlayer } from "@/components/adaptive-stream-player";
import { ArrowLeft, Loader2, Radio, ShieldCheck, WifiOff } from "lucide-react";
import type { MediaPlayerInstance } from "@vidstack/react";

interface PlayerConfig {
  id: string;
  name: string;
  primaryServer: string;
  servers: Record<string, { name: string; url: string; isIframe?: boolean; blockPopups?: boolean }>;
}

function normalizeServers(value: unknown): PlayerConfig["servers"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<PlayerConfig["servers"]>(
    (servers, [slot, server]) => {
      const entry = server && typeof server === "object" ? (server as Partial<{ name: string; url: string; isIframe?: boolean; blockPopups?: boolean }>) : {};
      servers[slot] = {
        name: typeof entry.name === "string" ? entry.name : "",
        url: typeof entry.url === "string" ? entry.url : "",
        isIframe: entry.isIframe === true,
        blockPopups: entry.blockPopups !== false,
      };
      return servers;
    },
    {}
  );
}

function normalizePlayer(value: unknown): PlayerConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const player = value as Partial<PlayerConfig> & { servers?: unknown };
  if (typeof player.id !== "string" || !player.id.trim()) {
    return null;
  }

  const servers = normalizeServers(player.servers);
  const firstServerId = Object.keys(servers)[0] ?? "1";

  return {
    id: player.id,
    name: typeof player.name === "string" ? player.name : "",
    primaryServer:
      typeof player.primaryServer === "string" && servers[player.primaryServer]
        ? player.primaryServer
        : firstServerId,
    servers,
  };
}

function getAvailableServers(servers: PlayerConfig["servers"]) {
  return Object.keys(servers)
    .filter((slot) => servers[slot]?.url)
    .map((slot) => ({
      id: slot,
      name: servers[slot]?.name || `Server ${slot}`,
    }));
}

function resolveActiveServerId(player: PlayerConfig, preferred?: string | null) {
  if (preferred && player.servers[preferred]?.url) {
    return preferred;
  }

  const primary = player.primaryServer || "1";
  if (player.servers[primary]?.url) {
    return primary;
  }

  return Object.keys(player.servers).find((slot) => player.servers[slot]?.url) ?? null;
}

function resolvePlaybackUrl(url: string, isIframe: boolean) {
  if (isIframe) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return url;
    }

    return `/api/stream?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return url;
  }
}

function arePlayersEqual(left: PlayerConfig | null, right: PlayerConfig | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function SinglePlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const playerId = resolvedParams.id;

  const [player, setPlayer] = useState<PlayerConfig | null>(null);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const videoPlayerRef = React.useRef<MediaPlayerInstance>(null);
  const activeServerIdRef = useRef<string | null>(null);
  const [isAutoSwitchEnabled, setIsAutoSwitchEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return localStorage.getItem("auto_switch_server_enabled") !== "false";
  });
  const toggleAutoSwitch = () => {
    const next = !isAutoSwitchEnabled;
    setIsAutoSwitchEnabled(next);
    localStorage.setItem("auto_switch_server_enabled", String(next));
  };

  useEffect(() => {
    activeServerIdRef.current = activeServerId;
  }, [activeServerId]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setPlayer(null);
      setActiveServerId(null);
      setError("");
      setIsLoading(true);
    });

    async function fetchPlayer({ silent = false }: { silent?: boolean } = {}) {
      try {
        const response = await fetch("/api/players", { cache: "no-store" });
        if (response.ok) {
          const data: PlayerConfig[] = await response.json();
          const found = data.find((p) => p.id === playerId);
          if (found) {
            const normalized = normalizePlayer(found);
            if (!normalized) {
              if (!silent) {
                setError(`Player with ID "${playerId}" not found.`);
              }
              return;
            }

            setPlayer((current) => {
              if (arePlayersEqual(current, normalized)) {
                return current;
              }
              return normalized;
            });
            if (!silent) {
              setError("");
            }
            setActiveServerId((current) => resolveActiveServerId(normalized, current ?? activeServerIdRef.current));
          } else {
            if (!silent) {
              setError(`Player with ID "${playerId}" not found.`);
            }
          }
        } else {
          if (!silent) {
            setError("Failed to fetch player settings from server.");
          }
        }
      } catch {
        if (!silent) {
          setError("An error occurred while loading stream.");
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    }

    fetchPlayer();

    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setWhatsappUrl(data.whatsappUrl || "");
        }
      } catch (settingsError) {
        console.error("Error loading settings:", settingsError);
      }
    }

    fetchSettings();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const availableServers = player ? getAvailableServers(player.servers) : [];

  const currentServer = player && activeServerId ? player.servers[activeServerId] ?? null : null;
  const currentStreamUrl = currentServer?.url ?? "";
  const playbackUrl = resolvePlaybackUrl(currentStreamUrl, currentServer?.isIframe === true);

  const switchServer = (serverId: string) => {
    const wasFullscreen = Boolean(videoPlayerRef.current?.state.fullscreen || document.fullscreenElement);
    setActiveServerId(serverId);

    if (!wasFullscreen) return;

    const restoreFullscreen = () => {
      const playerInstance = videoPlayerRef.current;
      if (!playerInstance || playerInstance.state.fullscreen) return;

      playerInstance.enterFullscreen("prefer-media").catch(() => {
        // Browsers can reject programmatic fullscreen after a source change.
      });
    };

    window.setTimeout(restoreFullscreen, 150);
    window.setTimeout(restoreFullscreen, 700);
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#09090b] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.24),transparent_46%),linear-gradient(135deg,rgba(15,23,42,0.75),rgba(9,9,11,0.2)_42%,rgba(6,78,59,0.12))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-2 px-4 pb-3 pt-0 sm:px-6 sm:pb-4 sm:pt-0 lg:px-8">
        <header className="flex items-center rounded-2xl border border-white/[0.07] bg-white/[0.035] p-1.5 shadow-xl shadow-black/20 backdrop-blur-md sm:p-2">
          <Link
            href="/"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/40 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/20 transition hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back</span>
          </Link>
        </header>

        {isLoading ? (
          <div className="grid min-h-[54vh] place-items-center rounded-3xl border border-white/[0.07] bg-black/50 p-8 text-center shadow-2xl shadow-black/30">
            <div className="flex flex-col items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/10">
                <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Loading stream</h2>
                <p className="mt-1 text-sm text-slate-400">Finding the best available server for this channel.</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="grid min-h-[54vh] place-items-center rounded-3xl border border-rose-500/20 bg-rose-950/10 p-8 text-center shadow-2xl shadow-black/30">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/10">
                <WifiOff className="h-8 w-8 text-rose-300" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Unable to open player</h2>
                <p className="mt-2 text-sm leading-6 text-rose-100/80">{error}</p>
              </div>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                Return home
              </Link>
            </div>
          </div>
        ) : player && currentStreamUrl ? (
          <section className="flex flex-1 flex-col gap-2">
            <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/12 via-white/[0.035] to-emerald-500/10 p-2 shadow-2xl shadow-black/40 ring-1 ring-white/[0.03] sm:p-3">
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.16),transparent_34%)]" />
              <div className="relative overflow-hidden rounded-[1.45rem] border border-black/60 bg-black shadow-inner shadow-black sm:rounded-[1.6rem]">
                <AdaptiveStreamPlayer
                  ref={videoPlayerRef}
                  src={playbackUrl}
                  title={player.name}
                  isIframe={currentServer?.isIframe === true}
                  blockIframePopups={currentServer?.blockPopups !== false}
                  autoPlay={true}
                  playerId={playerId}
                  servers={availableServers}
                  activeServerId={activeServerId}
                  onServerChange={switchServer}
                  isAutoSwitchEnabled={isAutoSwitchEnabled}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="rounded-3xl border border-white/[0.07] bg-[#0f1115]/80 px-3.5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:px-4 sm:py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-emerald-300" />
                      <h2 className="text-sm font-black uppercase tracking-wider text-white">
                        Stream Servers
                      </h2>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Choose another server if playback is slow or unavailable.
                    </p>
                  </div>
                </div>

                {whatsappUrl && (
                  <div className="mt-3 rounded-2xl border border-[#25D366]/20 bg-[#25D366]/10 px-3 py-3 shadow-lg shadow-black/15">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/20 bg-[#25D366] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#09090b] transition hover:bg-[#20ba5a] active:scale-[0.99]"
                    >
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12.031 2c-5.514 0-9.989 4.475-9.989 9.989 0 1.763.459 3.486 1.33 5.006L2 22l5.185-1.359a9.92 9.92 0 0 0 4.847 1.258c5.514 0 9.989-4.475 9.989-9.989S17.545 2 12.031 2zm0 18.294a8.276 8.276 0 0 1-4.222-1.157l-.303-.18-3.136.822.836-3.056-.197-.314a8.272 8.272 0 0 1-1.267-4.42c0-4.57 3.719-8.29 8.29-8.29 4.57 0 8.29 3.72 8.29 8.29s-3.72 8.29-8.29 8.29zM16.14 13.9c-.226-.113-1.337-.66-1.543-.736-.207-.076-.358-.113-.509.113-.15.226-.583.735-.715.885-.132.15-.263.17-.489.057a6.167 6.167 0 0 1-1.815-1.121 6.8 6.8 0 0 1-1.255-1.564c-.132-.226-.014-.348.099-.461.102-.102.226-.264.339-.396.113-.132.15-.226.226-.377.076-.15.038-.283-.019-.396-.056-.113-.509-1.225-.697-1.677-.183-.44-.369-.38-.509-.388a5.19 5.19 0 0 0-.433-.008c-.15 0-.396.056-.603.283-.207.226-.79.772-.79 1.883s.809 2.185.922 2.336c.113.15 1.59 2.429 3.854 3.407.538.232.959.371 1.287.475.54.172 1.03.148 1.417.09.433-.064 1.337-.546 1.525-1.074.189-.527.189-.979.132-1.074-.056-.095-.207-.15-.433-.264z" />
                      </svg>
                      <span>Join WhatsApp Group</span>
                    </a>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
                  {availableServers.map((server) => (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => switchServer(server.id)}
                      className={`min-h-11 min-w-0 rounded-2xl border px-3 py-2.5 text-sm font-bold transition active:scale-95 ${
                        activeServerId === server.id
                          ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100 shadow-lg shadow-emerald-950/20"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
                      }`}
                      aria-pressed={activeServerId === server.id}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            activeServerId === server.id ? "bg-emerald-300" : "bg-slate-600"
                          }`}
                        />
                        <span className="truncate">{server.name}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleAutoSwitch}
                  className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-black/25 px-3 py-2.5 text-left transition hover:border-violet-400/25 hover:bg-white/[0.05] active:scale-[0.99]"
                  aria-pressed={isAutoSwitchEnabled}
                  aria-label="Toggle automatic server switching"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                      Auto-Switch Stream
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-200">
                        Beta
                      </span>
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`hidden text-[10px] font-black uppercase tracking-wider sm:inline ${
                        isAutoSwitchEnabled ? "text-violet-200" : "text-slate-500"
                      }`}
                    >
                      {isAutoSwitchEnabled ? "On" : "Off"}
                    </span>
                    <span
                      className={`relative inline-flex h-6 w-11 rounded-full border transition ${
                        isAutoSwitchEnabled
                          ? "border-violet-400/30 bg-violet-500"
                          : "border-white/10 bg-slate-800"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          isAutoSwitchEnabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </div>
                </button>

              </div>
            </div>
          </section>
        ) : (
          <div className="grid min-h-[54vh] place-items-center rounded-3xl border border-dashed border-white/[0.08] bg-black/35 p-8 text-center shadow-2xl shadow-black/30">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-800/70">
                <WifiOff className="h-8 w-8 text-slate-500" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Channel offline</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  No live stream source is configured for this player right now. Check back later or open another match from the home page.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                Browse matches
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
