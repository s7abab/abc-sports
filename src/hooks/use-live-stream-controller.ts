"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { getBufferAhead, getLiveLatency, STREAM_HEALTH_TARGETS, type StreamRecoveryPhase, type StreamServerId } from "@/lib/stream-health";

interface LiveStreamControllerInput {
  src: string;
  playerRef: RefObject<MediaPlayerInstance | null>;
  activeServerId: StreamServerId | null;
  onServerChange?: (id: StreamServerId) => void;
  canPlay: boolean;
  waiting: boolean;
  error: unknown;
  currentTime: number;
  bufferedEnd: number;
  seekableEnd: number;
}

interface HlsErrorEvent {
  fatal?: boolean;
}

function getMediaElement(player: MediaPlayerInstance | null): HTMLMediaElement | null {
  const candidate = player as unknown as {
    el?: HTMLElement;
    media?: HTMLMediaElement;
    $el?: HTMLElement;
  } | null;

  if (!candidate) return null;
  if (candidate.media instanceof HTMLMediaElement) return candidate.media;

  const root = candidate.el ?? candidate.$el;
  return root?.querySelector?.("video, audio") ?? null;
}

export function useLiveStreamController({
  src,
  playerRef,
  activeServerId,
  onServerChange,
  canPlay,
  waiting,
  error,
  currentTime,
  bufferedEnd,
  seekableEnd,
}: LiveStreamControllerInput) {
  const [phase, setPhase] = useState<StreamRecoveryPhase>("starting");
  const [retryCount, setRetryCount] = useState(0);
  const srcStartedAtRef = useRef(0);
  const stallStartedAtRef = useRef<number | null>(null);
  const hlsFailureBurstRef = useRef(0);
  const handledErrorForSrcRef = useRef<string | null>(null);
  const handledStartupFailureForSrcRef = useRef<string | null>(null);
  const reloadedDuringStallRef = useRef(false);

  const bufferAhead = getBufferAhead(currentTime, bufferedEnd);
  const liveLatency = getLiveLatency(currentTime, seekableEnd);
  const handleRefresh = useCallback(() => {
    hlsFailureBurstRef.current = 0;
    handledErrorForSrcRef.current = null;
    handledStartupFailureForSrcRef.current = null;
    reloadedDuringStallRef.current = false;
    stallStartedAtRef.current = null;
    setRetryCount((prev) => prev + 1);
  }, []);

  const handleManualServerChange = useCallback(
    (serverId: StreamServerId) => {
      onServerChange?.(serverId);
    },
    [onServerChange]
  );

  const recordHlsError = useCallback(
    (event: HlsErrorEvent) => {
      hlsFailureBurstRef.current += 1;

      if (event.fatal || hlsFailureBurstRef.current >= 8) {
        if (!reloadedDuringStallRef.current) {
          reloadedDuringStallRef.current = true;
          setRetryCount((prev) => prev + 1);
        }
      }
    },
    []
  );

  useEffect(() => {
    srcStartedAtRef.current = Date.now();
    stallStartedAtRef.current = null;
    reloadedDuringStallRef.current = false;
    hlsFailureBurstRef.current = 0;
    handledErrorForSrcRef.current = null;
    handledStartupFailureForSrcRef.current = null;

    const resetTimer = window.setTimeout(() => {
      setPhase("starting");
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [src, activeServerId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      if (srcStartedAtRef.current === 0) {
        srcStartedAtRef.current = now;
      }

      const startupAge = now - srcStartedAtRef.current;
      const stalled =
        Boolean(error) ||
        (waiting && canPlay && bufferAhead < STREAM_HEALTH_TARGETS.minimumPlayableBuffer) ||
        (!canPlay && startupAge > STREAM_HEALTH_TARGETS.startupGraceMs);

      if (error) {
        if (handledErrorForSrcRef.current !== src) {
          handledErrorForSrcRef.current = src;
          setRetryCount((prev) => prev + 1);
        }
        setPhase("failed");
        return;
      }

      if (!canPlay && startupAge > STREAM_HEALTH_TARGETS.startupGraceMs) {
        const startupFailureKey = `${activeServerId ?? "unknown"}:${src}`;
        if (handledStartupFailureForSrcRef.current === startupFailureKey) {
          setPhase("degraded");
          return;
        }

        handledStartupFailureForSrcRef.current = startupFailureKey;
        setRetryCount((prev) => prev + 1);
        setPhase("degraded");
        return;
      }

      if (!stalled) {
        stallStartedAtRef.current = null;
        reloadedDuringStallRef.current = false;

        if (canPlay && bufferAhead >= STREAM_HEALTH_TARGETS.healthyBufferTarget) {
          setPhase("healthy");
        } else if (canPlay && bufferAhead < STREAM_HEALTH_TARGETS.minimumPlayableBuffer) {
          setPhase("buffering");
        } else {
          setPhase(canPlay ? "recovering" : "starting");
        }

        return;
      }

      if (stallStartedAtRef.current === null) {
        stallStartedAtRef.current = now;
      }

      const stallMs = now - stallStartedAtRef.current;

      if (stallMs >= STREAM_HEALTH_TARGETS.reloadAfterStallMs && !reloadedDuringStallRef.current) {
        reloadedDuringStallRef.current = true;
        setRetryCount((prev) => prev + 1);
      }

      setPhase(stallMs >= STREAM_HEALTH_TARGETS.reloadAfterStallMs ? "degraded" : "recovering");
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [activeServerId, bufferAhead, canPlay, error, src, waiting]);

  useEffect(() => {
    const media = getMediaElement(playerRef.current);
    if (!media || !canPlay || waiting) return;

    const shouldCatchUp =
      liveLatency !== null &&
      liveLatency > STREAM_HEALTH_TARGETS.catchupLatency &&
      bufferAhead >= STREAM_HEALTH_TARGETS.healthyBufferTarget;

    if (shouldCatchUp && media.playbackRate !== STREAM_HEALTH_TARGETS.catchupRate) {
      media.playbackRate = STREAM_HEALTH_TARGETS.catchupRate;
      return;
    }

    if (!shouldCatchUp && media.playbackRate !== 1) {
      media.playbackRate = 1;
    }
  }, [bufferAhead, canPlay, liveLatency, playerRef, waiting]);

  const statusTitle = useMemo(() => {
    if (phase === "degraded") return "Stream Degraded";
    if (phase === "recovering") return "Recovering Stream";
    if (phase === "buffering") return "Building Buffer";
    if (phase === "failed") return "Error Loading Stream";
    return "Connecting to Stream";
  }, [phase]);

  const statusMessage = useMemo(() => {
    if (phase === "failed") {
      return "This source is having trouble. Refresh it or choose another server manually.";
    }

    if (phase === "degraded" || phase === "recovering") {
      return "Building a safer live buffer for this source. You can wait or refresh it.";
    }

    if (phase === "buffering") {
      return "The stream is buffering. You can wait or refresh it.";
    }

    return "The stream is taking longer than usual to load. You can wait or refresh it.";
  }, [phase]);

  return {
    bufferAhead,
    handleManualServerChange,
    handleRefresh,
    liveLatency,
    phase,
    recordHlsError,
    sourceVersion: retryCount,
    statusMessage,
    statusTitle,
  };
}
