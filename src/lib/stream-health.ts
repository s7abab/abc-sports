export type StreamServerId = string;

export interface StreamServerOption {
  id: StreamServerId;
  name: string;
}

export type StreamRecoveryPhase =
  | "starting"
  | "healthy"
  | "buffering"
  | "recovering"
  | "degraded"
  | "switching"
  | "failed";

export interface StreamHealthSnapshot {
  bufferAhead: number;
  liveLatency: number | null;
  phase: StreamRecoveryPhase;
}

export interface StreamServerScore {
  score: number;
  failures: number;
  stalls: number;
  lastFailedAt: number;
  lastHealthyAt: number;
}

export const STREAM_HEALTH_TARGETS = {
  startupGraceMs: 5_000,
  startupBufferTarget: 8,
  minimumPlayableBuffer: 4,
  healthyBufferTarget: 24,
  degradedBufferThreshold: 1.5,
  maxLiveLatency: 75,
  catchupLatency: 45,
  catchupRate: 1.04,
  switchAfterStallMs: 15_000,
  reloadAfterStallMs: 8_000,
  minimumWatchBeforeSwitchMs: 15_000,
  serverCooldownMs: 45_000,
  manualSelectionLockMs: 5_000,
  healthyRewardIntervalMs: 30_000,
} as const;

export function clampServerScore(score: number) {
  return Math.max(0, Math.min(120, score));
}

export function createDefaultServerScore(): StreamServerScore {
  return {
    score: 80,
    failures: 0,
    stalls: 0,
    lastFailedAt: 0,
    lastHealthyAt: 0,
  };
}

export function getBufferAhead(currentTime: number, bufferedEnd: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(bufferedEnd)) return 0;
  return Math.max(0, bufferedEnd - currentTime);
}

export function getLiveLatency(currentTime: number, seekableEnd: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(seekableEnd)) return null;
  return Math.max(0, seekableEnd - currentTime);
}

export function getNextHealthyServer(
  servers: StreamServerOption[],
  currentServerId: StreamServerId,
  scores: Map<StreamServerId, StreamServerScore>,
  now: number
) {
  const candidates = servers
    .filter((server) => server.id !== currentServerId)
    .map((server) => {
      const health = scores.get(server.id) ?? createDefaultServerScore();
      const coolingDown =
        health.lastFailedAt > 0 &&
        now - health.lastFailedAt < STREAM_HEALTH_TARGETS.serverCooldownMs;

      return {
        server,
        health,
        coolingDown,
      };
    })
    .sort((a, b) => b.health.score - a.health.score);

  return candidates.find((candidate) => !candidate.coolingDown)?.server ?? null;
}
