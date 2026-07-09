"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { VideoPlayer } from "@/components/video-player";
import { MpegtsStreamPlayer } from "@/components/mpegts-stream-player";
import type { StreamServerId } from "@/lib/stream-health";

type StreamMode = "detecting" | "hls" | "mpegts" | "iframe";

interface AdaptiveStreamPlayerProps {
  src: string;
  title: string;
  isIframe?: boolean;
  blockIframePopups?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  playerId?: string;
  servers?: Array<{ id: StreamServerId; name: string }>;
  activeServerId?: StreamServerId | null;
  onServerChange?: (id: StreamServerId) => void;
  isAutoSwitchEnabled?: boolean;
}

function looksLikeHlsPath(src: string) {
  return /\.m3u8($|\?)/i.test(src) || /\.m3u($|\?)/i.test(src);
}

function resolvePlayableSrc(src: string, isIframe: boolean) {
  if (isIframe) return src;
  if (src.startsWith("/api/stream?url=")) {
    return typeof window === "undefined" ? src : `${window.location.origin}${src}`;
  }

  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return src;
    }

    const proxyPath = `/api/stream?url=${encodeURIComponent(parsed.toString())}`;
    return typeof window === "undefined" ? proxyPath : `${window.location.origin}${proxyPath}`;
  } catch {
    return src;
  }
}

export const AdaptiveStreamPlayer = forwardRef<MediaPlayerInstance, AdaptiveStreamPlayerProps>(
  (
    {
      src,
      title,
      isIframe = false,
      blockIframePopups = true,
      autoPlay = true,
      muted = false,
      playerId,
      servers = [],
      activeServerId,
      onServerChange,
      isAutoSwitchEnabled = true,
    },
    ref
  ) => {
    const [mode, setMode] = useState<StreamMode>("detecting");
    const hlsPlayerRef = useRef<MediaPlayerInstance>(null);
    const modeRef = useRef<StreamMode>("detecting");
    const playableSrc = resolvePlayableSrc(src, isIframe);

    useEffect(() => {
      modeRef.current = mode;
    }, [mode]);

    useImperativeHandle(
      ref,
      () =>
        hlsPlayerRef.current ??
        ({
          state: { fullscreen: false },
          enterFullscreen: async () => {},
        } as unknown as MediaPlayerInstance)
    );

    useEffect(() => {
      let cancelled = false;
      const timeoutId = window.setTimeout(() => {
        if (!cancelled && modeRef.current === "detecting") {
          setMode("mpegts");
        }
      }, 4000);

      async function detectStreamMode() {
        if (isIframe) {
          setMode("iframe");
          return;
        }

        if (looksLikeHlsPath(playableSrc)) {
          setMode("hls");
          return;
        }

        try {
          const controller = new AbortController();
          const abortId = window.setTimeout(() => controller.abort(), 2500);
          const response = await fetch(playableSrc, {
            method: "HEAD",
            cache: "no-store",
            signal: controller.signal,
          });
          window.clearTimeout(abortId);
          const contentType = response.headers.get("content-type") || "";

          if (cancelled) return;

          if (contentType.includes("mpegurl") || contentType.includes("m3u8")) {
            setMode("hls");
            return;
          }

          setMode("mpegts");
        } catch {
          if (!cancelled) {
            setMode("mpegts");
          }
        }
      }

      setMode("detecting");
      void detectStreamMode();

      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }, [isIframe, playableSrc]);

    if (mode === "detecting") {
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Probing stream
            </div>
          </div>
        </div>
      );
    }

    if (mode === "iframe") {
      return <VideoPlayer src={playableSrc} title={title} isIframe blockIframePopups={blockIframePopups} />;
    }

    if (mode === "mpegts") {
      return <MpegtsStreamPlayer src={playableSrc} title={title} autoPlay={autoPlay} muted={muted} />;
    }

    return (
      <VideoPlayer
        ref={hlsPlayerRef}
        src={playableSrc}
        title={title}
        autoPlay={autoPlay}
        muted={muted}
        playerId={playerId}
        servers={servers}
        activeServerId={activeServerId}
        onServerChange={onServerChange}
        isAutoSwitchEnabled={isAutoSwitchEnabled}
      />
    );
  }
);

AdaptiveStreamPlayer.displayName = "AdaptiveStreamPlayer";
