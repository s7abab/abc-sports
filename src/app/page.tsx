"use client";

import React from "react";
import { VideoPlayer } from "@/components/video-player";
import { Tv, Sparkles } from "lucide-react";

export default function Home() {
  const videoUrl = "https://play.gzxdby.com/live/183334344568_2547627111.m3u8";
  const title = "ABC Sports Live Broadcast";
  const poster = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200";

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/30 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

      <div className="w-full max-w-4xl space-y-4 z-10">
        
        {/* Header section with live badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Tv className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent leading-none">
                ABC Sports Live Broadcast
              </h1>
              <p className="text-[11px] text-slate-400 mt-1">
                Real-time high-definition video stream
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
                Live Broadcast
              </span>
            </div>
          </div>
        </div>

        {/* Video Player Component */}
        <VideoPlayer
          src={videoUrl}
          title={title}
          poster={poster}
        />
        
        {/* Footnote information */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1.5 pt-1">
          <p className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            Use the custom Fit/Fill button next to Fullscreen in the player controls to scale.
          </p>
          <p>Powered by Vidstack & Next.js</p>
        </div>

      </div>
    </main>
  );
}
