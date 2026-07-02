"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/video-player";
import { LiveMatchChat } from "@/components/live-match-chat";
import { Loader2, Server } from "lucide-react";

interface PlayerConfig {
  id: string;
  name: string;
  primaryServer: string;
  servers: Record<string, { name: string; url: string }>;
}

function useIsMobile() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(max-width: 1023px)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(max-width: 1023px)").matches,
    () => false
  );
}

export default function SinglePlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const playerId = resolvedParams.id;

  const [player, setPlayer] = useState<PlayerConfig | null>(null);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const isMobile = useIsMobile();
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

  const toggleChat = () => setIsChatOpen((prev) => !prev);

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const response = await fetch("/api/players");
        if (response.ok) {
          const data: PlayerConfig[] = await response.json();
          const found = data.find((p) => p.id === playerId);
          if (found) {
            setPlayer(found);

            // Default to primary server slot, falling back to first available slot if primary is unconfigured
            const primary = found.primaryServer || "1";
            if (found.servers?.[primary]?.url) {
              setActiveServerId(primary);
            } else {
              const availableSlots = Object.keys(found.servers ?? {}).filter((slot) => found.servers?.[slot]?.url);
              if (availableSlots.length > 0) {
                setActiveServerId(availableSlots[0]);
              }
            }
          } else {
            setError(`Player with ID "${playerId}" not found.`);
          }
        } else {
          setError("Failed to fetch player settings from server.");
        }
      } catch (err) {
        setError("An error occurred while loading stream.");
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setWhatsappUrl(data.whatsappUrl || "");
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    }

    fetchPlayer();
    fetchSettings();
  }, [playerId]);

  // Filter available servers
  const availableServers = player?.servers
    ? Object.keys(player.servers)
        .filter((slot) => player.servers[slot]?.url)
        .map((slot) => ({
          id: slot,
          name: player.servers[slot]?.name || `Server ${slot}`,
        }))
    : [];

  const currentStreamUrl = player && activeServerId ? player.servers[activeServerId]?.url : "";

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

      <div className="w-full max-w-7xl mx-auto px-4 pt-2 pb-4 md:pt-3 md:pb-5 z-10 flex-grow flex flex-col gap-2.5 md:gap-3">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-black hover:bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:text-white transition-all duration-200 active:scale-95 shadow-md"
            >
              ← Back
            </Link>
            {player && (
              <span className="text-xs font-black uppercase tracking-wider text-slate-200 truncate max-w-[120px] sm:max-w-[200px]">
                {player.name}
              </span>
            )}
          </div>
          
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-[#09090b] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-[0_2px_10px_rgba(37,211,102,0.2)] transition-all hover:scale-105 cursor-pointer animate-in fade-in duration-350"
            >
              <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 2c-5.514 0-9.989 4.475-9.989 9.989 0 1.763.459 3.486 1.33 5.006L2 22l5.185-1.359a9.92 9.92 0 004.847 1.258c5.514 0 9.989-4.475 9.989-9.989S17.545 2 12.031 2zm0 18.294a8.276 8.276 0 01-4.222-1.157l-.303-.18-3.136.822.836-3.056-.197-.314a8.272 8.272 0 01-1.267-4.42c0-4.57 3.719-8.29 8.29-8.29 4.57 0 8.29 3.72 8.29 8.29s-3.72 8.29-8.29 8.29zM16.14 13.9c-.226-.113-1.337-.66-1.543-.736-.207-.076-.358-.113-.509.113-.15.226-.583.735-.715.885-.132.15-.263.17-.489.057a6.167 6.167 0 01-1.815-1.121 6.8 6.8 0 01-1.255-1.564c-.132-.226-.014-.348.099-.461.102-.102.226-.264.339-.396.113-.132.15-.226.226-.377.076-.15.038-.283-.019-.396-.056-.113-.509-1.225-.697-1.677-.183-.44-.369-.38-.509-.388a5.19 5.19 0 00-.433-.008c-.15 0-.396.056-.603.283-.207.226-.79.772-.79 1.883s.809 2.185.922 2.336c.113.15 1.59 2.429 3.854 3.407.538.232.959.371 1.287.475.54.172 1.03.148 1.417.09.433-.064 1.337-.546 1.525-1.074.189-.527.189-.979.132-1.074-.056-.095-.207-.15-.433-.264z" />
              </svg>
              <span>WhatsApp</span>
            </a>
          )}
        </div>

        {/* Video Player Box */}
        {isLoading ? (
          <div className="aspect-video w-full rounded-2xl bg-black/60 border border-white/5 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Loading stream...</p>
          </div>
        ) : error ? (
          <div className="aspect-video w-full rounded-2xl bg-black/60 border border-white/5 flex flex-col items-center justify-center gap-2 text-center text-slate-400">
            <p className="text-sm font-semibold text-rose-400">{error}</p>
          </div>
        ) : player && currentStreamUrl ? (
          <div className="flex flex-col gap-2 w-full">
            <div className={`grid w-full gap-4 items-start transition-all duration-300 ${
              isChatOpen
                ? "lg:grid-cols-[minmax(0,1fr)_24rem] grid-cols-1"
                : "grid-cols-1"
            }`}>
              <div className="flex min-w-0 flex-col gap-4">
                <VideoPlayer
                  src={currentStreamUrl}
                  title={player.name}
                  autoPlay={true}
                  isChatOpen={isChatOpen}
                  onToggleChat={toggleChat}
                  playerId={playerId}
                  isMobile={isMobile}
                  servers={availableServers}
                  activeServerId={activeServerId}
                  onServerChange={(id) => setActiveServerId(id)}
                  isAutoSwitchEnabled={isAutoSwitchEnabled}
                />
              </div>

              {/* Side Chat: Only visible on desktop when toggled open */}
              <div className={`hidden lg:block ${isChatOpen ? "lg:block" : "lg:hidden"}`}>
                <LiveMatchChat playerId={playerId} roomTitle={player.name} />
              </div>
            </div>

            {/* Settings and Controls Card */}
            <div className="w-full bg-[#0f1115]/60 backdrop-blur-md border border-white/10 rounded-xl p-2 md:py-1.5 md:px-3 flex flex-col sm:flex-row sm:items-center justify-center gap-2.5 md:gap-4 transition-all duration-300 hover:border-violet-500/20">
              {/* Auto-Switch Server Switch */}
              <button
                type="button"
                onClick={toggleAutoSwitch}
                className="flex items-center justify-between gap-5 w-full sm:w-auto text-left cursor-pointer group focus:outline-none select-none hover:bg-white/[0.04] active:scale-[0.98] px-3 py-1.5 rounded-lg transition-all duration-200 border border-transparent hover:border-white/5"
                aria-label="Toggle automatic server switching"
              >
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-violet-400 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-xs font-bold text-slate-200">
                    Auto-Switch Server
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] font-bold tracking-wider uppercase transition-colors duration-200 ${isAutoSwitchEnabled ? "text-violet-400" : "text-slate-500"}`}>
                    {isAutoSwitchEnabled ? "ON" : "OFF"}
                  </span>
                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border border-transparent transition-colors duration-200 ease-in-out ${
                      isAutoSwitchEnabled ? "bg-violet-600" : "bg-slate-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        isAutoSwitchEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Divider on desktop */}
              <div className="hidden sm:block h-4 w-px bg-white/10" />

              <div className="flex min-w-0 w-full sm:w-auto flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex items-center gap-2 px-3 sm:px-0">
                  <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-200">
                    Servers
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5 px-3 sm:px-0">
                  {availableServers.map((server) => (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => setActiveServerId(server.id)}
                      className={`min-h-8 max-w-[9rem] rounded-lg border px-2.5 text-[10px] font-bold transition-all duration-200 active:scale-95 ${
                        activeServerId === server.id
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                      aria-pressed={activeServerId === server.id}
                    >
                      <span className="block truncate">{server.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Chat: visible when the overlay/side chat is closed */}
            {!isChatOpen && (
              <div className="w-full">
                <LiveMatchChat playerId={playerId} roomTitle={player.name} />
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-video w-full rounded-2xl bg-black/40 border border-dashed border-white/5 flex flex-col items-center justify-center p-6 text-center select-none text-slate-500">
            <svg className="w-10 h-10 text-slate-700 mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 0A3.75 3.75 0 0 0 12 18Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 0 0-15 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 12a9.75 9.75 0 0 0-19.5 0" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-400">Channel Offline</h3>
            <p className="text-[11px] text-slate-600 max-w-xs mt-1">
              There is currently no live stream source configured for this channel.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
