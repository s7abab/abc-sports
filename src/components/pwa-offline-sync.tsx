"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Loader2 } from "lucide-react";

import { flushQueuedMutations, getQueuedMutationCount } from "@/lib/pwa-offline-queue";

export function PwaOfflineSync() {
  const [queuedCount, setQueuedCount] = useState(() =>
    typeof window !== "undefined" ? getQueuedMutationCount() : 0
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastFlushed, setLastFlushed] = useState(0);

  useEffect(() => {
    const sync = async () => {
      if (!window.navigator.onLine || getQueuedMutationCount() === 0) return;

      setIsSyncing(true);
      const result = await flushQueuedMutations();
      setQueuedCount(result.remaining);
      setLastFlushed(result.flushed);
      setIsSyncing(false);

      if (result.flushed > 0) {
        window.setTimeout(() => setLastFlushed(0), 4500);
      }
    };

    const handleQueueChange = () => setQueuedCount(getQueuedMutationCount());
    const handleOnline = () => {
      void sync();
    };

    window.addEventListener("abc-sports-queue-change", handleQueueChange);
    window.addEventListener("online", handleOnline);
    void sync();

    return () => {
      window.removeEventListener("abc-sports-queue-change", handleQueueChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (queuedCount === 0 && lastFlushed === 0) return null;

  return (
    <div className="fixed left-4 bottom-4 z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-[#10141d]/95 px-4 py-3 text-sm text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {queuedCount > 0 ? (
          <div className="flex items-center gap-3">
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-300" />
            )}
            <span>
              {queuedCount} offline {queuedCount === 1 ? "change" : "changes"} waiting to sync.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <span>{lastFlushed} offline {lastFlushed === 1 ? "change" : "changes"} synced.</span>
          </div>
        )}
      </div>
    </div>
  );
}
