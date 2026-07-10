"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

interface MpegtsStreamPlayerProps {
  src: string;
  title: string;
  muted?: boolean;
  autoPlay?: boolean;
  children?: ReactNode;
}

type MpegtsPlayer = {
  attachMediaElement(mediaElement: HTMLVideoElement): void;
  load(): void;
  play(): Promise<void> | void;
  destroy(): void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type MpegtsModuleLike = {
  default?: {
    isSupported(): boolean;
    createPlayer(mediaDataSource: Record<string, unknown>, config?: Record<string, unknown>): MpegtsPlayer;
    Events: { ERROR: string };
  };
  isSupported(): boolean;
  createPlayer(mediaDataSource: Record<string, unknown>, config?: Record<string, unknown>): MpegtsPlayer;
  Events: { ERROR: string };
};

const MPEGTS_REFRESH_BEFORE_MS = 4 * 60_000 + 30_000;

export function MpegtsStreamPlayer({
  src,
  title,
  muted = false,
  autoPlay = true,
  children,
}: MpegtsStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let player: MpegtsPlayer | null = null;
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        if (cancelled) return;
        setIsReady(false);
        setErrorMessage("");
        setReloadToken((current) => current + 1);
      }, MPEGTS_REFRESH_BEFORE_MS);
    };

    async function initPlayer() {
      try {
        const mod = await import("mpegts.js");
        const mpegtsModule = mod as unknown as MpegtsModuleLike;
        const mpegts = mpegtsModule.default ?? mpegtsModule;
        const videoEl = videoRef.current;

        if (!videoEl) return;
        if (!mpegts?.isSupported?.()) {
          setErrorMessage("This browser cannot play MPEG-TS streams.");
          return;
        }

        const nextPlayer = mpegts.createPlayer(
          {
            type: "mpegts",
            isLive: true,
            url: src,
            cors: true,
            withCredentials: false,
          },
          {
            isLive: true,
            enableWorker: true,
            enableWorkerForMSE: true,
            enableStashBuffer: false,
            lazyLoad: false,
            autoCleanupSourceBuffer: true,
            referrerPolicy: "no-referrer-when-downgrade",
          }
        );
        player = nextPlayer;

        const handleError = () => {
          setErrorMessage("Unable to load this stream.");
        };

        nextPlayer.on?.(mpegts.Events.ERROR, handleError);
        nextPlayer.attachMediaElement(videoEl);
        nextPlayer.load();
        scheduleRefresh();
        if (!cancelled) {
          setIsReady(true);
        }

        if (autoPlay) {
          await Promise.resolve(nextPlayer.play()).catch(() => {
            // Autoplay can be blocked; the controls remain usable.
          });
        }
      } catch (error) {
        console.error("MPEG-TS player error:", error);
        setErrorMessage("Unable to load this stream.");
      }
    }

    void initPlayer();

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        // Ignore cleanup errors.
      }
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [autoPlay, reloadToken, src]);

  if (errorMessage) {
    return (
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-950/20">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-300" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Playback failed</h3>
            <p className="mt-1 text-xs leading-5 text-rose-100/80">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        aria-label={title}
        className="h-full w-full bg-black"
        controls
        muted={muted}
        playsInline
      />
      {!isReady && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading stream
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
