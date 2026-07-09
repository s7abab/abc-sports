"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Tv } from "lucide-react";

import type { MatchConfig } from "@/lib/match-storage";
import {
  deriveRuntimeMatchStatus,
  getMatchSortValue,
  getMatchLiveStart,
  parseMatchDateTime,
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

function formatMatchCardDate(dateString: string) {
  const hasTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString);
  const matchDate = parseMatchDateTime(dateString);

  if (!matchDate) {
    return dateString;
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchMidnight = new Date(
    matchDate.getFullYear(),
    matchDate.getMonth(),
    matchDate.getDate()
  );
  const diffTime = matchMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let relativeDay = "";
  if (diffDays === 0) {
    relativeDay = "Today";
  } else if (diffDays === 1) {
    relativeDay = "Tomorrow";
  } else if (diffDays === -1) {
    relativeDay = "Yesterday";
  }

  if (relativeDay) {
    if (hasTime) {
      const timeFormatted = matchDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).toLowerCase();
      return `${relativeDay}, ${timeFormatted}`;
    }

    return relativeDay;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(matchDate);
}

export default function Home() {
  const [matches, setMatches] = useState<MatchConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

    fetchMatches();
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
    <main className="app-shell selection:bg-violet-500/20 selection:text-white">
      <div className="app-container">
        <div className="mx-auto w-full max-w-5xl space-y-3">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-cyan-500 text-[11px] font-black tracking-[0.18em] text-white shadow-[0_18px_40px_rgba(124,58,237,0.28)]">
                ABC
              </div>
              <h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                ABC Sports
              </h1>
            </div>

            <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-300 sm:inline-flex">
              Live schedule
            </span>
          </header>

          {isLoading ? (
            <div className="app-panel mt-6 flex flex-col items-center justify-center gap-3 rounded-3xl p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <p className="text-xs text-slate-400">Loading schedule in your timezone...</p>
            </div>
          ) : error ? (
            <div className="app-panel mt-6 rounded-3xl border-rose-500/20 bg-rose-500/5 p-12 text-center">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          ) : upcomingMatches.length === 0 ? (
            <div className="app-panel mt-6 rounded-3xl p-12 text-center">
              <p className="text-sm text-zinc-500">
                No upcoming matches scheduled. Check back later!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in duration-300">
              {upcomingMatches.map((match, index) => {
                const isNext = index === 0;
                const formattedDate = formatMatchCardDate(match.date);
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

                    <div className="grid grid-cols-[1.2fr_1fr_1.2fr] items-center gap-2 text-center">
                      <div className="flex flex-col items-center min-w-0">
                        <TeamLogo name={match.home} logoUrl={match.homeLogoUrl} size="lg" />
                        <span className="text-xs font-semibold text-zinc-200 truncate w-full mt-1.5 group-hover:text-white transition-colors">
                          {match.home}
                        </span>
                      </div>

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

                      <div className="flex flex-col items-center min-w-0">
                        <TeamLogo name={match.away} logoUrl={match.awayLogoUrl} size="lg" />
                        <span className="text-xs font-semibold text-zinc-200 truncate w-full mt-1.5 group-hover:text-white transition-colors">
                          {match.away}
                        </span>
                      </div>
                    </div>

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
      </div>
    </main>
  );
}
