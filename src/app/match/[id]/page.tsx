import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { readMatch } from "@/lib/match-storage";
import {
  deriveRuntimeMatchStatus,
  formatMatchDate,
  getMatchLiveStart,
} from "@/lib/match-utils";
import { MatchCountdown } from "./countdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const whatsappGroupUrl = process.env.WHATSAPP_GROUP_URL || "";

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
        className="h-20 w-20 rounded-full border border-white/15 bg-white object-contain p-3 shadow-[0_14px_45px_rgba(0,0,0,0.3)]"
      />
    );
  }

  return (
    <div
      aria-label={`${name} logo`}
      className="grid h-20 w-20 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-black text-white shadow-[0_14px_45px_rgba(0,0,0,0.3)]"
    >
      {initials || name[0]?.toUpperCase()}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M16.02 4C9.4 4 4.02 9.28 4.02 15.78c0 2.08.57 4.12 1.65 5.9L4 28l6.5-1.64A12.2 12.2 0 0 0 16.02 27C22.64 27 28 21.72 28 15.22 28 8.72 22.64 4 16.02 4Zm0 20.96c-1.76 0-3.47-.46-4.98-1.34l-.36-.2-3.86.98.99-3.67-.24-.38a9.25 9.25 0 0 1-1.43-4.95c0-5.38 4.43-9.75 9.88-9.75 5.45 0 9.88 4.37 9.88 9.75s-4.43 9.56-9.88 9.56Zm5.42-7.17c-.3-.15-1.77-.86-2.04-.96-.27-.1-.47-.15-.67.15-.2.29-.77.95-.95 1.14-.17.2-.35.22-.65.08-.3-.15-1.26-.46-2.4-1.46-.89-.78-1.49-1.74-1.66-2.03-.17-.3-.02-.46.13-.6.13-.13.3-.34.45-.51.15-.17.2-.29.3-.49.1-.19.05-.36-.03-.51-.07-.15-.67-1.59-.92-2.18-.24-.57-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.36-.27.3-1.05 1.01-1.05 2.47s1.08 2.87 1.23 3.07c.15.19 2.13 3.2 5.17 4.48.72.3 1.28.49 1.72.62.72.22 1.38.19 1.9.12.58-.09 1.77-.72 2.02-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.34Z" />
    </svg>
  );
}

export default async function MatchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await readMatch(id);

  if (!match) {
    notFound();
  }

  const status = deriveRuntimeMatchStatus(match.date);
  const playerHref = `/player/${match.playerId}`;

  if (status === "live") {
    redirect(playerHref);
  }

  const liveStart = getMatchLiveStart(match.date);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(24,182,153,0.24),transparent_32rem),linear-gradient(135deg,#07110f_0%,#101510_48%,#050608_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col justify-center">
        <Link
          href="/"
          className="mb-6 w-fit text-xs font-bold uppercase tracking-[0.24em] text-white/45 transition hover:text-white"
        >
          Back
        </Link>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-emerald-200/80">
            {match.competition}
          </p>

          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
            <div className="flex flex-col items-center text-center">
              <TeamLogo name={match.home} logoUrl={match.homeLogoUrl} />
              <p className="mt-4 text-xl font-black sm:text-3xl">{match.home}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.24em] text-white/40">
                Home
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-white/70">
              vs
            </span>
            <div className="flex flex-col items-center text-center">
              <TeamLogo name={match.away} logoUrl={match.awayLogoUrl} />
              <p className="mt-4 text-xl font-black sm:text-3xl">{match.away}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.24em] text-white/40">
                Away
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-sm font-semibold text-white/75">
            {formatMatchDate(match.date)}
          </p>

          {status === "completed" ? (
            <p className="mt-8 text-center text-xs font-black uppercase tracking-[0.28em] text-emerald-200">
              Completed
            </p>
          ) : liveStart ? (
            <div className="mt-8">
              <p className="mb-4 text-center text-xs font-black uppercase tracking-[0.28em] text-white/45">
                Live starts in
              </p>
              <MatchCountdown liveStartTime={liveStart.getTime()} playerHref={playerHref} />
            </div>
          ) : null}

          <div className="mt-8 rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-100">
                  Join the match room
                </p>
                <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-white/65">
                  Get the stream alert, quick updates, and the live link as soon as this match opens.
                </p>
              </div>
            {whatsappGroupUrl ? (
              <a
                href={whatsappGroupUrl}
                target="_blank"
                rel="noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_40px_rgba(37,211,102,0.25)] transition hover:bg-[#1fbd5a]"
              >
                  <WhatsAppIcon />
                  Join WhatsApp
              </a>
            ) : (
                <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white/35">
                  <WhatsAppIcon />
                  WhatsApp Soon
              </span>
            )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
