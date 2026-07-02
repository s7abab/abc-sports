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
  const [whatsappUrl, setWhatsappUrl] = useState("");

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

    fetchMatch();
    fetchSettings();
  }, [id]);

  const status = match
    ? (match.live ? "live" : (match.status === "completed" ? "completed" : deriveRuntimeMatchStatus(match.date)))
    : null;
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
            <div className="mt-10 border-t border-white/[0.05] pt-8 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="h-12 w-12 rounded-full bg-zinc-900/50 border border-white/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Match Completed</h3>
              <p className="text-xs text-zinc-550 mt-2 max-w-xs leading-relaxed">
                This event has finished and the live broadcast is over. Check the schedule for other active streams.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition duration-200"
              >
                Back to Schedule
              </Link>
            </div>
          ) : liveStart ? (
            <div className="mt-10 border-t border-white/[0.05] pt-8">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Live Stream Starts In
              </p>
              <MatchCountdown liveStartTime={liveStart.getTime()} playerHref={playerHref} />
            </div>
          ) : null}

          {whatsappUrl && (
            <div className="mt-8 pt-6 border-t border-white/[0.05] flex flex-col items-center justify-center animate-in fade-in duration-350">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-3">
                Join our community for stream updates
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-[#09090b] px-5 py-2 text-xs font-black shadow-[0_2px_15px_rgba(37,211,102,0.25)] transition-all hover:scale-105 cursor-pointer"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 2c-5.514 0-9.989 4.475-9.989 9.989 0 1.763.459 3.486 1.33 5.006L2 22l5.185-1.359a9.92 9.92 0 004.847 1.258c5.514 0 9.989-4.475 9.989-9.989S17.545 2 12.031 2zm0 18.294a8.276 8.276 0 01-4.222-1.157l-.303-.18-3.136.822.836-3.056-.197-.314a8.272 8.272 0 01-1.267-4.42c0-4.57 3.719-8.29 8.29-8.29 4.57 0 8.29 3.72 8.29 8.29s-3.72 8.29-8.29 8.29zM16.14 13.9c-.226-.113-1.337-.66-1.543-.736-.207-.076-.358-.113-.509.113-.15.226-.583.735-.715.885-.132.15-.263.17-.489.057a6.167 6.167 0 01-1.815-1.121 6.8 6.8 0 01-1.255-1.564c-.132-.226-.014-.348.099-.461.102-.102.226-.264.339-.396.113-.132.15-.226.226-.377.076-.15.038-.283-.019-.396-.056-.113-.509-1.225-.697-1.677-.183-.44-.369-.38-.509-.388a5.19 5.19 0 00-.433-.008c-.15 0-.396.056-.603.283-.207.226-.79.772-.79 1.883s.809 2.185.922 2.336c.113.15 1.59 2.429 3.854 3.407.538.232.959.371 1.287.475.54.172 1.03.148 1.417.09.433-.064 1.337-.546 1.525-1.074.189-.527.189-.979.132-1.074-.056-.095-.207-.15-.433-.264z" />
                </svg>
                <span>Join WhatsApp Group</span>
              </a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
