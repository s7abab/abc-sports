import Link from "next/link";

import { readMatches } from "@/lib/match-storage";
import {
  deriveRuntimeMatchStatus,
  formatMatchDate,
  getMatchSortValue,
  type RuntimeMatchStatus,
} from "@/lib/match-utils";

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

export default async function Home() {
  const matches = await readMatches();
  const now = new Date();
  const upcomingMatches = matches
    .map((match) => ({
      ...match,
      runtimeStatus: deriveRuntimeMatchStatus(match.date, now),
    }))
    .filter((match) => match.runtimeStatus !== "completed")
    .sort((first, second) => getMatchSortValue(first.date) - getMatchSortValue(second.date));

  return (
    <main className="relative min-h-screen bg-zinc-950 px-4 pt-6 sm:pt-8 pb-12 text-zinc-100 sm:px-6 lg:px-8 font-sans overflow-x-hidden selection:bg-emerald-500/20 selection:text-white">
      {/* Background soft glowing accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.07),transparent_50rem)] pointer-events-none" />

      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-black text-sm tracking-tighter shadow-[0_4px_20px_rgba(52,211,153,0.25)]">
              ABC
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                ABC SPORTS
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">
                Match Schedule & Streams
              </p>
            </div>
          </div>
        </header>

        {upcomingMatches.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-12 text-center backdrop-blur-md">
            <p className="text-sm text-zinc-500">
              No upcoming matches scheduled. Check back later!
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {upcomingMatches.map((match, index) => {
              const isNext = index === 0;
              const meta = statusMeta(match.runtimeStatus);
              return (
                <Link
                  key={match.id}
                  href={matchHref(match)}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.01] backdrop-blur-md p-4 transition-all duration-300 hover:bg-white/[0.03] hover:border-white/10 hover:shadow-[0_8px_25px_rgba(0,0,0,0.5)] group flex flex-col justify-between"
                >
                  {/* Top Row: Competition Name & Badges */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      {match.competition}
                    </span>
                    <div className="flex items-center gap-2">
                      {isNext && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                          NEXT
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${meta.className}`}
                      >
                        {match.runtimeStatus === "live" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Middle Matchup Row with Big Logos */}
                  <div className="my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    {/* Home Team */}
                    <div className="flex flex-col items-center text-center gap-1.5 min-w-0">
                      <TeamLogo name={match.home} logoUrl={match.homeLogoUrl} size="md" />
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate w-full">
                        {match.home}
                      </span>
                    </div>

                    {/* VS Center Divider */}
                    <div className="flex flex-col items-center gap-1 shrink-0 px-2">
                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900/60 px-1.5 py-0.5 rounded border border-white/[0.05] shadow-inner select-none">
                        VS
                      </span>
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center text-center gap-1.5 min-w-0">
                      <TeamLogo name={match.away} logoUrl={match.awayLogoUrl} size="md" />
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate w-full">
                        {match.away}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Date & Action Link */}
                  <div className="border-t border-white/[0.04] pt-3 flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium text-[11px]">{formatMatchDate(match.date)}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform duration-300">
                      {match.runtimeStatus === "live" ? "Watch Live →" : "Details →"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
