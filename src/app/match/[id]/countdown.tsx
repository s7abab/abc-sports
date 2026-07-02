"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PLAYER_LINK_LEAD_MS = 10 * 60 * 1000;

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];
}

export function MatchCountdown({
  liveStartTime,
  playerHref,
}: {
  liveStartTime: number;
  playerHref: string;
}) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState(() => liveStartTime - Date.now());

  useEffect(() => {
    const update = () => {
      const nextRemainingMs = liveStartTime - Date.now();
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs <= 0) {
        router.replace(playerHref);
      }
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [liveStartTime, playerHref, router]);

  const items = formatRemaining(remainingMs);
  const showPlayerLink = remainingMs > 0 && remainingMs <= PLAYER_LINK_LEAD_MS;

  return (
    <div className="flex flex-col items-center gap-4">
      {showPlayerLink && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
            Player link available
          </p>
          <Link
            href={playerHref}
            className="inline-flex items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 px-5 py-2 text-xs font-black uppercase tracking-wider text-violet-200 transition-all duration-200 hover:border-violet-400/40 hover:bg-violet-500/20 hover:text-white"
          >
            Open Player
          </Link>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 sm:gap-4 max-w-sm mx-auto">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#0f1115]/60 py-3.5 px-2 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-violet-500/20 hover:bg-[#181a22]/60"
          >
            <span className="text-xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 tracking-tight tabular-nums">
              {String(item.value).padStart(2, "0")}
            </span>
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-1.5">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
