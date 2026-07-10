"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

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

const SLOT_COUNT = 2;
const MPEGTS_PRELOAD_BEFORE_MS = 4 * 60_000 + 30_000;
const MPEGTS_RETRY_MS = 15_000;

function getNextSlot(slot: number) {
  return (slot + 1) % SLOT_COUNT;
}

export function MpegtsStreamPlayer({
  src,
  title,
  muted = false,
  autoPlay = true,
  children,
}: MpegtsStreamPlayerProps) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const playerRefs = useRef<Array<MpegtsPlayer | null>>([null, null]);
  const detachRefs = useRef<Array<(() => void) | null>>([null, null]);
  const preloadTimerRef = useRef<number | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const sourceIdRef = useRef(0);
  const frontSlotRef = useRef(0);
  const [frontSlot, setFrontSlot] = useState(0);
  const [activeReady, setActiveReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const clearTimer = useCallback((timerRef: MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupSlot = useCallback((slot: number) => {
    detachRefs.current[slot]?.();
    detachRefs.current[slot] = null;

    const player = playerRefs.current[slot];
    playerRefs.current[slot] = null;

    try {
      player?.destroy();
    } catch {
      // Ignore cleanup errors.
    }
  }, []);

  const destroyAll = useCallback(() => {
    clearTimer(preloadTimerRef);
    clearTimer(cleanupTimerRef);
    cleanupSlot(0);
    cleanupSlot(1);
  }, [clearTimer, cleanupSlot]);

  useEffect(() => {
    cancelledRef.current = false;

    return () => {
      cancelledRef.current = true;
      destroyAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sourceId = sourceIdRef.current + 1;
    sourceIdRef.current = sourceId;

    destroyAll();
    const resetTimer = window.setTimeout(() => {
      if (cancelledRef.current || sourceIdRef.current !== sourceId) return;
      setErrorMessage("");
      setActiveReady(false);
      setFrontSlot(0);
      frontSlotRef.current = 0;
    }, 0);

    const isCurrentSource = () => !cancelledRef.current && sourceIdRef.current === sourceId;

    const scheduleNextPreload = () => {
      clearTimer(preloadTimerRef);
      preloadTimerRef.current = window.setTimeout(() => {
        void preloadStandby();
      }, MPEGTS_PRELOAD_BEFORE_MS);
    };

    const scheduleRetry = () => {
      clearTimer(preloadTimerRef);
      preloadTimerRef.current = window.setTimeout(() => {
        void preloadStandby();
      }, MPEGTS_RETRY_MS);
    };

    const swapToSlot = (nextSlot: number) => {
      if (!isCurrentSource() || nextSlot === frontSlotRef.current) return;

      const previousSlot = frontSlotRef.current;
      frontSlotRef.current = nextSlot;
      setFrontSlot(nextSlot);
      setActiveReady(true);
      clearTimer(preloadTimerRef);
      clearTimer(cleanupTimerRef);

      cleanupTimerRef.current = window.setTimeout(() => {
        if (!isCurrentSource()) return;
        cleanupSlot(previousSlot);
      }, 500);

      scheduleNextPreload();
    };

    const handleVisibleError = (slot: number) => {
      if (!isCurrentSource()) return;

      const standbySlot = getNextSlot(slot);
      if (playerRefs.current[standbySlot]) {
        swapToSlot(standbySlot);
        return;
      }

      setErrorMessage("Unable to load this stream.");
    };

    const attachSlotListeners = (slot: number, videoEl: HTMLVideoElement, player: MpegtsPlayer) => {
      const markReady = () => {
        if (!isCurrentSource()) return;
        if (slot === frontSlotRef.current) {
          setActiveReady(true);
        } else {
          swapToSlot(slot);
        }
      };

      const onError = () => {
        if (!isCurrentSource()) return;
        if (slot === frontSlotRef.current) {
          handleVisibleError(slot);
        } else {
          scheduleRetry();
        }
      };

      videoEl.addEventListener("canplay", markReady);
      videoEl.addEventListener("playing", markReady);
      videoEl.addEventListener("error", onError);
      player.on?.("error", onError);

      const detach = () => {
        videoEl.removeEventListener("canplay", markReady);
        videoEl.removeEventListener("playing", markReady);
        videoEl.removeEventListener("error", onError);
        player.off?.("error", onError);
      };

      detachRefs.current[slot] = detach;
    };

    const createPlayer = async (slot: number) => {
      const videoEl = videoRefs.current[slot];
      if (!videoEl) return null;

      const mod = await import("mpegts.js");
      const mpegtsModule = mod as unknown as MpegtsModuleLike;
      const mpegts = mpegtsModule.default ?? mpegtsModule;

      if (!mpegts?.isSupported?.()) {
        setErrorMessage("This browser cannot play MPEG-TS streams.");
        return null;
      }

      const player = mpegts.createPlayer(
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

      playerRefs.current[slot] = player;
      attachSlotListeners(slot, videoEl, player);

      try {
        player.attachMediaElement(videoEl);
        player.load();

        if (autoPlay) {
          await Promise.resolve(player.play()).catch(() => {
            // Autoplay can be blocked; controls remain available.
          });
        }
      } catch {
        cleanupSlot(slot);
        if (slot === frontSlotRef.current) {
          setErrorMessage("Unable to load this stream.");
        }
        return null;
      }

      return player;
    };

    const preloadStandby = async () => {
      if (!isCurrentSource()) return;

      const standbySlot = getNextSlot(frontSlotRef.current);
      if (playerRefs.current[standbySlot]) return;

      const player = await createPlayer(standbySlot);
      if (!player || !isCurrentSource()) {
        scheduleRetry();
        return;
      }

      if (frontSlotRef.current === standbySlot) {
        scheduleNextPreload();
        return;
      }
    };

    const initialize = async () => {
      const player = await createPlayer(0);
      if (!player || !isCurrentSource()) return;

      scheduleNextPreload();
    };

    void initialize();

    return () => {
      window.clearTimeout(resetTimer);
      destroyAll();
    };
  }, [autoPlay, cleanupSlot, clearTimer, destroyAll, src]);

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
      {[0, 1].map((slot) => (
        <video
          key={slot}
          ref={(element) => {
            videoRefs.current[slot] = element;
          }}
          aria-label={slot === frontSlot ? title : undefined}
          aria-hidden={slot !== frontSlot}
          tabIndex={slot === frontSlot ? 0 : -1}
          className={`absolute inset-0 h-full w-full bg-black transition-opacity duration-300 ${
            slot === frontSlot ? "opacity-100" : "opacity-0"
          }`}
          controls={slot === frontSlot}
          muted={muted}
          playsInline
        />
      ))}

      {!activeReady && (
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
