"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Tv, Info } from "lucide-react";

import type { MatchConfig } from "@/lib/match-storage";
import {
  deriveRuntimeMatchStatus,
  formatMatchDate,
  getMatchSortValue,
  getMatchLiveStart,
  type RuntimeMatchStatus,
} from "@/lib/match-utils";

function MatchCardCountdownOnly({
  matchDateString,
}: {
  matchDateString: string;
}) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const liveStart = getMatchLiveStart(matchDateString);
    if (!liveStart) return;

    const update = () => {
      setRemainingMs(liveStart.getTime() - Date.now());
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [matchDateString]);

  if (remainingMs === null || remainingMs <= 0) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let countdownText = "";
  if (days > 0) {
    countdownText = `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    countdownText = `${hours}h ${minutes}m ${seconds}s`;
  } else {
    countdownText = `${minutes}m ${seconds}s`;
  }

  return (
    <span className="text-xs font-extrabold text-violet-400 tabular-nums animate-pulse">
      {countdownText}
    </span>
  );
}

function TeamLogo({
  name,
  logoUrl,
  size = "sm",
}: {
  name: string;
  logoUrl: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  let dimensions = "h-8 w-8";
  let padding = "p-1";
  let font = "text-[10px]";

  if (size === "md") {
    dimensions = "h-11 w-11";
    padding = "p-1";
    font = "text-xs";
  } else if (size === "lg") {
    dimensions = "h-14 w-14";
    padding = "p-1.5";
    font = "text-sm";
  }

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={`${dimensions} rounded-full border border-white/10 bg-white object-contain ${padding} shadow-sm transition-transform duration-300 group-hover:scale-105`}
      />
    );
  }

  return (
    <div
      aria-label={`${name} logo`}
      className={`grid ${dimensions} place-items-center rounded-full border border-white/10 bg-zinc-900/60 ${font} font-bold text-zinc-400 transition-transform duration-300 group-hover:scale-105`}
    >
      {initials || name[0]?.toUpperCase()}
    </div>
  );
}

function statusMeta(status: RuntimeMatchStatus) {
  if (status === "live") {
    return {
      label: "Live",
      className: "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      className: "border-zinc-850 bg-zinc-900/40 text-zinc-500",
    };
  }

  return {
    label: "Scheduled",
    className: "border-zinc-800 bg-zinc-900/10 text-zinc-400",
  };
}

function matchHref(match: { id: string; playerId: string; runtimeStatus: RuntimeMatchStatus }) {
  if (match.runtimeStatus === "live") {
    return `/player/${match.playerId}`;
  }

  return `/match/${match.id}`;
}

export default function Home() {
  const [matches, setMatches] = useState<MatchConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");

  useEffect(() => {
    async function fetchMatches() {
      try {
        const response = await fetch("/api/matches");
        if (response.ok) {
          const data = await response.json();
          setMatches(data);
        } else {
          setError("Failed to load match schedule.");
        }
      } catch (err) {
        setError("An error occurred while loading schedule.");
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

    fetchMatches();
    fetchSettings();
  }, []);

  const now = new Date();
  const upcomingMatches = matches
    .map((match) => ({
      ...match,
      runtimeStatus: match.live
        ? ("live" as RuntimeMatchStatus)
        : (match.status === "completed" ? ("completed" as RuntimeMatchStatus) : deriveRuntimeMatchStatus(match.date, now)),
    }))
    .filter((match) => match.runtimeStatus !== "completed")
    .sort((first, second) => getMatchSortValue(first.date) - getMatchSortValue(second.date));

  return (
    <main className="relative min-h-screen bg-[#09090b] px-4 pt-6 sm:pt-8 pb-12 text-slate-100 sm:px-6 lg:px-8 font-sans overflow-x-hidden selection:bg-violet-500/20 selection:text-white">
      {/* Background soft glowing accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0" />

      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between border-b border-white/[0.06] pb-6">
          <div className="flex -translate-x-6 items-center gap-3.5 sm:-translate-x-10">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center font-black text-white text-sm tracking-tighter shadow-[0_4px_20px_rgba(139,92,246,0.25)]">
              ABC
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                ABC SPORTS
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                Match Schedule & Streams
              </p>
            </div>
          </div>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-[#09090b] px-3.5 py-1.5 text-xs font-black shadow-[0_2px_15px_rgba(37,211,102,0.25)] transition-all hover:scale-105 cursor-pointer animate-in fade-in duration-350"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 2c-5.514 0-9.989 4.475-9.989 9.989 0 1.763.459 3.486 1.33 5.006L2 22l5.185-1.359a9.92 9.92 0 004.847 1.258c5.514 0 9.989-4.475 9.989-9.989S17.545 2 12.031 2zm0 18.294a8.276 8.276 0 01-4.222-1.157l-.303-.18-3.136.822.836-3.056-.197-.314a8.272 8.272 0 01-1.267-4.42c0-4.57 3.719-8.29 8.29-8.29 4.57 0 8.29 3.72 8.29 8.29s-3.72 8.29-8.29 8.29zM16.14 13.9c-.226-.113-1.337-.66-1.543-.736-.207-.076-.358-.113-.509.113-.15.226-.583.735-.715.885-.132.15-.263.17-.489.057a6.167 6.167 0 01-1.815-1.121 6.8 6.8 0 01-1.255-1.564c-.132-.226-.014-.348.099-.461.102-.102.226-.264.339-.396.113-.132.15-.226.226-.377.076-.15.038-.283-.019-.396-.056-.113-.509-1.225-.697-1.677-.183-.44-.369-.38-.509-.388a5.19 5.19 0 00-.433-.008c-.15 0-.396.056-.603.283-.207.226-.79.772-.79 1.883s.809 2.185.922 2.336c.113.15 1.59 2.429 3.854 3.407.538.232.959.371 1.287.475.54.172 1.03.148 1.417.09.433-.064 1.337-.546 1.525-1.074.189-.527.189-.979.132-1.074-.056-.095-.207-.15-.433-.264z" />
              </svg>
              <span>Join WhatsApp</span>
            </a>
          )}
        </header>

        {isLoading ? (
          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-12 text-center backdrop-blur-md flex flex-col items-center justify-center gap-3 animate-pulse">
            <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
            <p className="text-xs text-slate-400">Loading schedule in your timezone...</p>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-12 text-center backdrop-blur-md">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        ) : upcomingMatches.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-12 text-center backdrop-blur-md">
            <p className="text-sm text-zinc-500">
              No upcoming matches scheduled. Check back later!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in duration-300">
            {upcomingMatches.map((match, index) => {
              const isNext = index === 0;
              const formattedDate = formatMatchDate(match.date);
              const parts = formattedDate.split(", ");
              const relativeDay = parts[0];
              const timeString = parts[1] || "";

              return (
                <Link
                  key={match.id}
                  href={matchHref(match)}
                  className={`relative overflow-hidden rounded-2xl border p-3 sm:p-4 flex flex-col justify-between shadow-lg transition-all duration-300 group cursor-pointer ${
                    match.runtimeStatus === "live"
                      ? "border-rose-500/40 bg-gradient-to-b from-[#251014] to-[#12080a] shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:border-rose-500 hover:shadow-[0_0_25px_rgba(244,63,94,0.2)]"
                      : "border-white/10 bg-[#0f1115]/60 backdrop-blur-md hover:bg-[#181a22]/60 hover:border-violet-500/20"
                  }`}
                >
                  {/* Top Row: Competition Name & Header */}
                  <div className={`flex items-center justify-between text-[11px] font-normal border-b pb-2 mb-3 ${
                    match.runtimeStatus === "live"
                      ? "text-rose-300 border-rose-950/40"
                      : "text-slate-400 border-white/[0.05]"
                  }`}>
                    <span className="truncate max-w-[75%] font-medium">
                      {match.competition}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {match.runtimeStatus === "live" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 border border-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 uppercase tracking-wide">
                          ON AIR
                        </span>
                      ) : isNext ? (
                        <span className="inline-flex items-center gap-1 rounded bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400">
                          NEXT
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Middle Matchup Row: Home Team, Status/Time, Away Team */}
                  <div className="grid grid-cols-[1.2fr_1fr_1.2fr] items-center gap-2 text-center">
                    {/* Home Team */}
                    <div className="flex flex-col items-center min-w-0">
                      <TeamLogo name={match.home} logoUrl={match.homeLogoUrl} size="lg" />
                      <span className="text-xs font-semibold text-zinc-200 truncate w-full mt-1.5 group-hover:text-white transition-colors">
                        {match.home}
                      </span>
                    </div>

                    {/* Date/Status Center */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                      {match.runtimeStatus === "live" ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[9px] font-black text-white uppercase tracking-widest shadow-[0_2px_8px_rgba(220,38,38,0.4)]">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                            </span>
                            Live
                          </span>
                          <span className="text-[9px] text-rose-300/80 font-bold uppercase tracking-wider group-hover:text-white transition-colors">
                            Watch Now
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                            {relativeDay}
                          </span>
                          {timeString && (
                            <span className="text-base font-extrabold text-white mt-0.5 tracking-tight">
                              {timeString}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center min-w-0">
                      <TeamLogo name={match.away} logoUrl={match.awayLogoUrl} size="lg" />
                      <span className="text-xs font-semibold text-zinc-200 truncate w-full mt-1.5 group-hover:text-white transition-colors">
                        {match.away}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Countdown footer */}
                  {match.runtimeStatus !== "completed" && match.runtimeStatus !== "live" && (
                    <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400">
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Starts in</span>
                      <MatchCardCountdownOnly matchDateString={match.date} />
                    </div>
                  )}

                  {match.runtimeStatus === "live" && (
                    <div className="mt-3 pt-2.5 border-t border-rose-500/20 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-rose-400 group-hover:text-rose-200 transition-colors">
                      <Tv className="h-3.5 w-3.5 text-rose-500 group-hover:text-rose-300 transition-colors animate-pulse" />
                      <span className="text-[9px] uppercase tracking-wider font-extrabold">Watch Stream Live</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
