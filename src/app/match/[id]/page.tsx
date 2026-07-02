"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import type { MatchConfig } from "@/lib/match-storage";
import {
  deriveRuntimeMatchStatus,
  formatMatchDate,
  getMatchLiveStart,
} from "@/lib/match-utils";
import { MatchCountdown } from "./countdown";

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
    dimensions = "h-14 w-14";
    padding = "p-1.5";
    font = "text-base";
  } else if (size === "lg") {
    dimensions = "h-20 w-20";
    padding = "p-2.5";
    font = "text-xl";
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

export default function MatchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = React.use(params);

  const [match, setMatch] = useState<MatchConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMatch() {
      try {
        const response = await fetch(`/api/matches/${id}`);
        if (response.status === 404) {
          setError("not-found");
        } else if (response.ok) {
          const data = await response.json();
          setMatch(data);
        } else {
          setError("Failed to load match details.");
        }
      } catch (err) {
        setError("An error occurred while loading match details.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchMatch();
  }, [id]);

  const status = match ? deriveRuntimeMatchStatus(match.date) : null;
  const playerHref = match ? `/player/${match.playerId}` : "";

  // Auto redirect if match is live
  useEffect(() => {
    if (status === "live" && playerHref) {
      router.replace(playerHref);
    }
  }, [status, playerHref, router]);

  if (error === "not-found") {
    notFound();
  }

  if (isLoading) {
    return (
      <main className="relative min-h-screen bg-zinc-950 px-4 pt-6 sm:pt-8 pb-12 text-zinc-100 sm:px-6 lg:px-8 font-sans flex flex-col items-center justify-center overflow-x-hidden">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
        <p className="text-xs text-zinc-400 mt-2">Loading match details...</p>
      </main>
    );
  }

  if (error || !match) {
    return (
      <main className="relative min-h-screen bg-zinc-950 px-4 pt-6 sm:pt-8 pb-12 text-zinc-100 sm:px-6 lg:px-8 font-sans flex flex-col items-center justify-center overflow-x-hidden">
        <p className="text-sm text-rose-400">{error || "Failed to load match details."}</p>
        <Link href="/" className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
          ← Back to Schedule
        </Link>
      </main>
    );
  }

  const liveStart = getMatchLiveStart(match.date);

  return (
    <main className="relative min-h-screen bg-zinc-950 px-4 pt-6 sm:pt-8 pb-12 text-zinc-100 sm:px-6 lg:px-8 font-sans flex flex-col items-center overflow-x-hidden selection:bg-emerald-500/20 selection:text-white">
      {/* Background soft glowing accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.08),transparent_55rem)] pointer-events-none" />

      <div className="relative mx-auto w-full max-w-xl flex flex-col">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Back to Schedule
        </Link>

        <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-xl p-8 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center group">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            {match.competition}
          </p>

          <div className="mt-10 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-3 w-32">
              <TeamLogo name={match.home} logoUrl={match.homeLogoUrl} size="lg" />
              <p className="text-sm font-bold text-zinc-100 truncate w-full">{match.home}</p>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Home</span>
            </div>

            <div className="h-10 w-10 rounded-full border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0 select-none shadow-inner">
              VS
            </div>

            <div className="flex flex-col items-center gap-3 w-32">
              <TeamLogo name={match.away} logoUrl={match.awayLogoUrl} size="lg" />
              <p className="text-sm font-bold text-zinc-100 truncate w-full">{match.away}</p>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Away</span>
            </div>
          </div>

          <p className="mt-8 text-xs font-medium text-zinc-400">
            {formatMatchDate(match.date)}
          </p>

          {status === "completed" ? (
            <p className="mt-10 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Completed
            </p>
          ) : liveStart ? (
            <div className="mt-10 border-t border-white/[0.05] pt-8">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Live Stream Starts In
              </p>
              <MatchCountdown liveStartTime={liveStart.getTime()} playerHref={playerHref} />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
