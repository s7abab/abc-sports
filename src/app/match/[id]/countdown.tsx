"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <div className="grid grid-cols-4 gap-3 sm:gap-4 max-w-sm mx-auto">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-3.5 px-2 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
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
  );
}
