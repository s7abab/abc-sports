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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {formatRemaining(remainingMs).map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center"
        >
          <p className="text-3xl font-black tabular-nums text-white">
            {String(item.value).padStart(2, "0")}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}
