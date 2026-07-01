"use client";

import React, { useState, useEffect } from "react";
import { VideoPlayer } from "@/components/video-player";
import { Tv, Sparkles, Loader2 } from "lucide-react";

interface PlayerConfig {
  id: string;
  name: string;
  url: string;
}

export default function DashboardPage() {
  const [players, setPlayers] = useState<PlayerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const response = await fetch("/api/players");
        if (response.ok) {
          const data = await response.json();
          setPlayers(data);
        }
      } catch (err) {
        console.error("Error loading players:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col p-4 md:p-8 relative overflow-x-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

      <div className="w-full max-w-7xl mx-auto space-y-6 z-10 flex-grow flex flex-col">
        {/* Header section with live badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Tv className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent leading-none">
                ABC Sports Multiscreen Control Room
              </h1>
              <p className="text-[11px] text-slate-400 mt-1">
                Real-time multi-view monitoring dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 px-3 py-1.5 rounded-xl">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest leading-none">
                Live Grid
              </span>
            </div>
          </div>
        </div>

        {/* Players Grid */}
        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-40 gap-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            <p className="text-xs text-slate-400">Loading feeds...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {players.map((player) => (
              <div
                key={player.id}
                className="group flex flex-col bg-[#0f0f13] border border-white/5 rounded-2xl p-3 hover:border-violet-500/20 hover:shadow-xl hover:shadow-violet-950/5 transition-all duration-300 relative overflow-hidden"
              >
                {/* Header label for each player */}
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 group-hover:animate-pulse"></span>
                    {player.name}
                  </span>
                  {player.url ? (
                    <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                      OFFLINE
                    </span>
                  )}
                </div>

                {/* Video Player or Inactive Placeholder */}
                {player.url ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black/90">
                    <VideoPlayer
                      src={player.url}
                      title={player.name}
                      muted={true}
                      autoPlay={true}
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full rounded-xl border border-dashed border-white/5 bg-black/40 flex flex-col items-center justify-center p-4 text-slate-600 relative overflow-hidden select-none">
                    <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none"></div>
                    <svg className="w-7 h-7 text-slate-700 mb-2.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 0A3.75 3.75 0 0 0 12 18Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 0 0-15 0" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 12a9.75 9.75 0 0 0-19.5 0" />
                    </svg>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">
                      No Signal
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footnote information */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 px-1 py-4 border-t border-white/5 gap-2 mt-auto">
          <p className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            Click on any active feed's player controls to scale size, toggle picture-in-picture, or unmute.
          </p>
          <p>Powered by Vidstack & Next.js</p>
        </div>
      </div>
    </main>
  );
}
