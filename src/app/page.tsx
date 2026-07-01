import Link from "next/link";

import { readMatches } from "@/lib/match-storage";
import {
  deriveRuntimeMatchStatus,
  formatMatchDate,
  getMatchSortValue,
  type RuntimeMatchStatus,
} from "@/lib/match-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="h-14 w-14 rounded-full border border-white/15 bg-white object-contain p-2 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
      />
    );
  }

  return (
    <div
      aria-label={`${name} logo`}
      className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/10 text-sm font-bold text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
    >
      {initials || name[0]?.toUpperCase()}
    </div>
  );
}

function statusMeta(status: RuntimeMatchStatus) {
  if (status === "live") {
    return {
      label: "Live",
      className: "border-red-400/40 bg-red-500 text-white shadow-[0_0_28px_rgba(239,68,68,0.35)]",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    };
  }

  if (status === "today") {
    return {
      label: "Today",
      className: "border-white/10 bg-transparent text-white/55",
    };
  }

  return {
    label: "Upcoming",
    className: "border-white/10 bg-transparent text-white/55",
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
  const nextMatch = upcomingMatches[0];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(24,182,153,0.26),transparent_32rem),linear-gradient(135deg,#07110f_0%,#101510_48%,#050608_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-300 text-lg font-black tracking-[-0.08em] text-emerald-950 shadow-[0_12px_35px_rgba(110,231,183,0.28)]">
              ABC
            </span>
            <div>
              <h1 className="text-3xl font-black uppercase leading-none tracking-[-0.05em] text-white sm:text-5xl">
                ABC Sports
              </h1>
            </div>
          </div>
        </header>

        {upcomingMatches.length === 0 ? (
          <p className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No upcoming matches are available yet.
          </p>
        ) : (
          <>
            {nextMatch ? (
              <Link
                href={matchHref(nextMatch)}
                className="mt-8 block overflow-hidden rounded-[2rem] border border-emerald-200/20 bg-emerald-100/[0.08] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.38)] transition hover:border-emerald-200/35 hover:bg-emerald-100/[0.11] sm:p-8"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.32em] text-emerald-200/80">
                      Next Match
                    </p>
                    <p className="mt-3 text-sm font-medium text-white/65">{nextMatch.competition}</p>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
                    <div className="flex flex-col items-center text-center">
                      <TeamLogo name={nextMatch.home} logoUrl={nextMatch.homeLogoUrl} />
                      <p className="mt-3 text-base font-bold sm:text-xl">{nextMatch.home}</p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-white/70">
                      vs
                    </span>
                    <div className="flex flex-col items-center text-center">
                      <TeamLogo name={nextMatch.away} logoUrl={nextMatch.awayLogoUrl} />
                      <p className="mt-3 text-base font-bold sm:text-xl">{nextMatch.away}</p>
                    </div>
                  </div>

                  <div className="lg:text-right">
                    {(() => {
                      const meta = statusMeta(nextMatch.runtimeStatus);

                      return (
                        <>
                    <p className="text-sm font-semibold text-white">{formatMatchDate(nextMatch.date)}</p>
                    <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${meta.className}`}>
                      {meta.label}
                    </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </Link>
            ) : null}

            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              {upcomingMatches.map((match) => (
                <Link
                  key={match.id}
                  href={matchHref(match)}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.25)] transition hover:border-white/20 hover:bg-white/[0.09]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamLogo name={match.home} logoUrl={match.homeLogoUrl} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{match.home}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
                          Home
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-black uppercase tracking-[0.22em] text-white/45">
                      vs
                    </span>
                    <div className="flex min-w-0 items-center gap-3 text-right">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{match.away}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
                          Away
                        </p>
                      </div>
                      <TeamLogo name={match.away} logoUrl={match.awayLogoUrl} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    {(() => {
                      const meta = statusMeta(match.runtimeStatus);

                      return (
                        <>
                    <p className="text-sm font-semibold text-white/80">{formatMatchDate(match.date)}</p>
                    <p className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${meta.className}`}>
                      {meta.label}
                    </p>
                        </>
                      );
                    })()}
                  </div>
                </Link>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
