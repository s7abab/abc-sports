"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import {
  clampServerScore,
  createDefaultServerScore,
  getBufferAhead,
  getLiveLatency,
  getNextHealthyServer,
  STREAM_HEALTH_TARGETS,
  type StreamRecoveryPhase,
  type StreamServerId,
  type StreamServerOption,
  type StreamServerScore,
} from "@/lib/stream-health";

interface LiveStreamControllerInput {
  src: string;
  playerId?: string;
  playerRef: RefObject<MediaPlayerInstance | null>;
  servers: StreamServerOption[];
  activeServerId: StreamServerId | null;
  onServerChange?: (id: StreamServerId) => void;
  isAutoSwitchEnabled: boolean;
  canPlay: boolean;
  waiting: boolean;
  playing: boolean;
  error: unknown;
  currentTime: number;
  bufferedEnd: number;
  seekableEnd: number;
}

interface HlsErrorEvent {
  fatal?: boolean;
  type?: string;
  details?: string;
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
  playerId,
  playerRef,
  servers,
  activeServerId,
  onServerChange,
  isAutoSwitchEnabled,
  canPlay,
  waiting,
  playing,
  error,
  currentTime,
  bufferedEnd,
  seekableEnd,
}: LiveStreamControllerInput) {
  const [phase, setPhase] = useState<StreamRecoveryPhase>("starting");
  const [retryCount, setRetryCount] = useState(0);
  const [autoSwitchingTo, setAutoSwitchingTo] = useState<string | null>(null);
  const [nextServerName, setNextServerName] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [failedServerIds, setFailedServerIds] = useState<Set<StreamServerId>>(new Set());

  const scoresRef = useRef(new Map<StreamServerId, StreamServerScore>());
  const srcStartedAtRef = useRef(0);
  const stallStartedAtRef = useRef<number | null>(null);
  const lastSwitchAtRef = useRef(0);
  const manualLockUntilRef = useRef(0);
  const reloadedDuringStallRef = useRef(false);
  const hlsFailureBurstRef = useRef(0);
  const handledErrorForSrcRef = useRef<string | null>(null);
  const reportedRecoveryRef = useRef(false);
  const lastReportedEventRef = useRef(new Map<string, number>());

  const bufferAhead = getBufferAhead(currentTime, bufferedEnd);
  const liveLatency = getLiveLatency(currentTime, seekableEnd);
  const allStreamsFailed =
    servers.length > 0 && servers.every((server) => failedServerIds.has(server.id));

  const finalSrc = useMemo(() => src, [src]);

  const reportHealthEvent = useCallback(
    (payload: {
      type: "server_failed" | "server_switch" | "stream_recovered";
      serverId: string;
      serverName?: string;
      targetServerId?: string;
      targetServerName?: string;
      reason?: string;
    }) => {
      if (!playerId) return;

      const key = [
        payload.type,
        playerId,
        payload.serverId,
        payload.targetServerId ?? "",
        payload.reason ?? "",
      ].join(":");
      const now = Date.now();
      const cooldownMs =
        payload.type === "server_failed"
          ? 60_000
          : payload.type === "server_switch"
          ? 15_000
          : 30_000;
      const lastReportedAt = lastReportedEventRef.current.get(key) ?? 0;

      if (now - lastReportedAt < cooldownMs) {
        return;
      }

      lastReportedEventRef.current.set(key, now);

      fetch("/api/stream-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          ...payload,
        }),
        keepalive: true,
      }).catch(() => {
        // Health reporting must never affect playback.
      });
    },
    [playerId]
  );

  const ensureScore = useCallback((serverId: StreamServerId) => {
    const existing = scoresRef.current.get(serverId);
    if (existing) return existing;

    const created = createDefaultServerScore();
    scoresRef.current.set(serverId, created);
    return created;
  }, []);

  const updateScore = useCallback(
    (serverId: StreamServerId, delta: number, patch?: Partial<StreamServerScore>) => {
      const current = ensureScore(serverId);
      scoresRef.current.set(serverId, {
        ...current,
        ...patch,
        score: clampServerScore(current.score + delta),
      });
    },
    [ensureScore]
  );

  const markServerFailed = useCallback(
    (serverId: StreamServerId, penalty = -30) => {
      const now = Date.now();
      const current = ensureScore(serverId);

      scoresRef.current.set(serverId, {
        ...current,
        failures: current.failures + 1,
        lastFailedAt: now,
        score: clampServerScore(current.score + penalty),
      });

      setFailedServerIds((prev) => {
        if (prev.has(serverId)) return prev;
        const next = new Set(prev);
        next.add(serverId);
        return next;
      });

      const serverName = servers.find((server) => server.id === serverId)?.name;
      reportHealthEvent({
        type: "server_failed",
        serverId,
        serverName,
        reason: "Playback health dropped below recovery threshold.",
      });
    },
    [ensureScore, reportHealthEvent, servers]
  );

  const switchToBestServer = useCallback(
    (reason: "error" | "stall" | "hls") => {
      if (!activeServerId || !onServerChange || !isAutoSwitchEnabled) return false;

      const now = Date.now();
      const canSwitch =
        reason === "error" ||
        reason === "hls" ||
        (now - srcStartedAtRef.current >= STREAM_HEALTH_TARGETS.minimumWatchBeforeSwitchMs &&
          now >= manualLockUntilRef.current);

      if (!canSwitch || now - lastSwitchAtRef.current < 4_000) return false;

      const nextServer = getNextHealthyServer(
        servers,
        activeServerId,
        scoresRef.current,
        now
      );

      if (!nextServer) return false;

      lastSwitchAtRef.current = now;
      setPhase("switching");
      setAutoSwitchingTo(nextServer.name);
      reportHealthEvent({
        type: "server_switch",
        serverId: activeServerId,
        serverName: servers.find((server) => server.id === activeServerId)?.name,
        targetServerId: nextServer.id,
        targetServerName: nextServer.name,
        reason,
      });
      onServerChange(nextServer.id);

      window.setTimeout(() => {
        setAutoSwitchingTo(null);
      }, 4_000);

      return true;
    },
    [activeServerId, isAutoSwitchEnabled, onServerChange, reportHealthEvent, servers]
  );

  const handleRefresh = useCallback(() => {
    setFailedServerIds(new Set());
    setCountdown(null);
    setNextServerName(null);
    setAutoSwitchingTo(null);
    hlsFailureBurstRef.current = 0;
    reloadedDuringStallRef.current = false;
    stallStartedAtRef.current = null;
    scoresRef.current.clear();
    setRetryCount((prev) => prev + 1);
  }, []);

  const handleManualServerChange = useCallback(
    (serverId: StreamServerId) => {
      manualLockUntilRef.current = Date.now() + STREAM_HEALTH_TARGETS.manualSelectionLockMs;
      setFailedServerIds((prev) => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
      onServerChange?.(serverId);
    },
    [onServerChange]
  );

  const recordHlsError = useCallback(
    (event: HlsErrorEvent) => {
      if (!activeServerId) return;

      hlsFailureBurstRef.current += 1;
      const isFatal = Boolean(event.fatal);
      const penalty = isFatal ? -35 : -8;

      updateScore(activeServerId, penalty);

      if (isFatal || hlsFailureBurstRef.current >= 4) {
        markServerFailed(activeServerId, isFatal ? -35 : -18);
        if (!switchToBestServer("hls")) {
          setRetryCount((prev) => prev + 1);
        }
      }
    },
    [activeServerId, markServerFailed, switchToBestServer, updateScore]
  );

  useEffect(() => {
    srcStartedAtRef.current = Date.now();
    stallStartedAtRef.current = null;
    reloadedDuringStallRef.current = false;
    hlsFailureBurstRef.current = 0;
    handledErrorForSrcRef.current = null;
    reportedRecoveryRef.current = false;

    const resetTimer = window.setTimeout(() => {
      setCountdown(null);
      setNextServerName(null);
      setPhase("starting");
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [src, activeServerId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!activeServerId) return;

      if ((playing || canPlay) && !waiting && !error) {
        const current = ensureScore(activeServerId);
        const now = Date.now();

        hlsFailureBurstRef.current = 0;
        setFailedServerIds((prev) => {
          if (!prev.has(activeServerId)) return prev;
          const next = new Set(prev);
          next.delete(activeServerId);
          return next;
        });

        if (now - current.lastHealthyAt >= STREAM_HEALTH_TARGETS.healthyRewardIntervalMs) {
          scoresRef.current.set(activeServerId, {
            ...current,
            lastHealthyAt: now,
            score: clampServerScore(current.score + 10),
          });
        }

        if (!reportedRecoveryRef.current) {
          reportedRecoveryRef.current = true;
          reportHealthEvent({
            type: "stream_recovered",
            serverId: activeServerId,
            serverName: servers.find((server) => server.id === activeServerId)?.name,
            reason: "Playback is healthy again.",
          });
        }
      }
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [activeServerId, canPlay, ensureScore, error, playing, reportHealthEvent, servers, waiting]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      if (srcStartedAtRef.current === 0) {
        srcStartedAtRef.current = now;
      }
      const startupAge = now - srcStartedAtRef.current;
      const stalled =
        Boolean(error) ||
        waiting ||
        (!canPlay && startupAge > STREAM_HEALTH_TARGETS.startupGraceMs) ||
        (canPlay && bufferAhead < STREAM_HEALTH_TARGETS.degradedBufferThreshold);

      if (!activeServerId) {
        setPhase("starting");
        return;
      }

      if (error) {
        if (handledErrorForSrcRef.current !== src) {
          handledErrorForSrcRef.current = src;
          markServerFailed(activeServerId, -35);
        }
        setPhase("failed");
        switchToBestServer("error");
        return;
      }

      if (!stalled) {
        stallStartedAtRef.current = null;
        reloadedDuringStallRef.current = false;
        setCountdown(null);
        setNextServerName(null);

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
        const current = ensureScore(activeServerId);
        scoresRef.current.set(activeServerId, {
          ...current,
          stalls: current.stalls + 1,
          score: clampServerScore(current.score - 8),
        });
      }

      const stallMs = now - stallStartedAtRef.current;
      const secondsToSwitch = Math.max(
        0,
        Math.ceil((STREAM_HEALTH_TARGETS.switchAfterStallMs - stallMs) / 1000)
      );

      if (stallMs >= STREAM_HEALTH_TARGETS.reloadAfterStallMs && !reloadedDuringStallRef.current) {
        reloadedDuringStallRef.current = true;
        setRetryCount((prev) => prev + 1);
      }

      if (stallMs >= STREAM_HEALTH_TARGETS.switchAfterStallMs) {
        markServerFailed(activeServerId, -18);
        setCountdown(null);
        setNextServerName(null);

        if (!switchToBestServer("stall")) {
          setPhase("degraded");
        }
        return;
      }

      const nextServer = getNextHealthyServer(
        servers,
        activeServerId,
        scoresRef.current,
        now
      );

      setCountdown(isAutoSwitchEnabled && nextServer ? secondsToSwitch : null);
      setNextServerName(isAutoSwitchEnabled && nextServer ? nextServer.name : null);
      setPhase(stallMs >= STREAM_HEALTH_TARGETS.reloadAfterStallMs ? "degraded" : "recovering");
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [
    activeServerId,
    bufferAhead,
    canPlay,
    ensureScore,
    error,
    isAutoSwitchEnabled,
    markServerFailed,
    servers,
    src,
    switchToBestServer,
    waiting,
  ]);

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
    if (allStreamsFailed) return "All Streams Offline";
    if (phase === "switching") return "Switching Server";
    if (phase === "degraded") return "Stream Degraded";
    if (phase === "recovering") return "Recovering Stream";
    if (phase === "buffering") return "Building Buffer";
    if (phase === "failed") return "Error Loading Stream";
    return "Connecting to Stream";
  }, [allStreamsFailed, phase]);

  const statusMessage = useMemo(() => {
    if (allStreamsFailed) {
      return "We tried all available stream servers but none of them are responding right now. Please refresh or select a server manually.";
    }

    if (phase === "switching" && autoSwitchingTo) {
      return `Loading ${autoSwitchingTo} because the current stream became unstable.`;
    }

    if (countdown !== null && nextServerName) {
      return `Stream is not buffering fast enough. Switching to ${nextServerName} in ${countdown}s if it does not recover.`;
    }

    if (phase === "degraded") {
      return "The player is retrying this source and allowing more live delay so playback can stabilize.";
    }

    if (phase === "recovering" || phase === "buffering") {
      return "Building a safer live buffer before forcing a server change.";
    }

    return "The stream is taking longer than usual to load. You can wait, refresh, or choose another server.";
  }, [allStreamsFailed, autoSwitchingTo, countdown, nextServerName, phase]);

  return {
    allStreamsFailed,
    autoSwitchingTo,
    bufferAhead,
    countdown,
    failedServerIds,
    finalSrc,
    handleManualServerChange,
    handleRefresh,
    liveLatency,
    nextServerName,
    phase,
    recordHlsError,
    sourceVersion: retryCount,
    statusMessage,
    statusTitle,
  };
}
