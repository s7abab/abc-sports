"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isSupportedOrigin =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSupportedOrigin) return;

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;

          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(nextWorker);
            }
          });
        });
      })
      .catch((error: unknown) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-lg rounded-2xl border border-sky-300/20 bg-[#0c1018]/95 p-4 text-sm text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-white">New ABC Sports version ready</p>
          <p className="mt-1 text-xs text-slate-300">Refresh to use the latest PWA files.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-sky-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
    </div>
  );
}
