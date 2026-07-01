"use client";

import React, { useState, useEffect } from "react";
import { VideoPlayer } from "@/components/video-player";
import { Loader2 } from "lucide-react";

interface PlayerConfig {
  id: string;
  name: string;
  servers: {
    "1": { name: string; url: string };
    "2": { name: string; url: string };
    "3": { name: string; url: string };
    "4": { name: string; url: string };
  };
}

export default function SinglePlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const playerId = resolvedParams.id;

  const [player, setPlayer] = useState<PlayerConfig | null>(null);
  const [activeServerId, setActiveServerId] = useState<"1" | "2" | "3" | "4" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const response = await fetch("/api/players");
        if (response.ok) {
          const data: PlayerConfig[] = await response.json();
          const found = data.find((p) => p.id === playerId);
          if (found) {
            setPlayer(found);
            
            // Default to the first available server slot that has a URL
            const availableSlots = (["1", "2", "3", "4"] as const).filter(
              (slot) => found.servers?.[slot]?.url
            );
            if (availableSlots.length > 0) {
              setActiveServerId(availableSlots[0]);
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
    fetchPlayer();
  }, [playerId]);

  const poster = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

  // Filter available servers
  const availableServers = player?.servers
    ? (["1", "2", "3", "4"] as const).filter((slot) => player.servers[slot]?.url)
    : [];

  const currentStreamUrl = player && activeServerId ? player.servers[activeServerId]?.url : "";

  return (
    <main className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden relative">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading feed...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
          <p className="text-sm font-semibold text-rose-400">{error}</p>
        </div>
      ) : player && currentStreamUrl ? (
        <>
          <div className="w-full h-full">
            <VideoPlayer
              src={currentStreamUrl}
              title={player.name}
              poster={poster}
              autoPlay={true}
            />
          </div>

          {/* Floating Server Switcher Overlay */}
          {availableServers.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full shadow-2xl z-40 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <span className="text-[8px] font-bold text-slate-400 mr-1 uppercase tracking-wider select-none">
                Servers:
              </span>
              {availableServers.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setActiveServerId(slot)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-full transition-all duration-150 active:scale-95 cursor-pointer ${
                    activeServerId === slot
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/20"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5"
                  }`}
                >
                  {player.servers[slot]?.name || `Server ${slot}`}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center select-none text-slate-500">
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
    </main>
  );
}
