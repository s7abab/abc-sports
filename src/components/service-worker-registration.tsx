"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isSupportedOrigin =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSupportedOrigin) return;

    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
          console.error("Service worker registration failed:", error);
        });
      },
      { once: true }
    );
  }, []);

  return null;
}
