"use client";

import {
  MediaPlayer,
  MediaProvider,
  PIPButton,
  isHLSProvider,
  useMediaState,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
} from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Crop, Server } from "lucide-react";
import type { StreamServerId } from "@/lib/stream-health";

interface VideoPlayerProps {
  src: string;
  title: string;
  isIframe?: boolean;
  blockIframePopups?: boolean;
  thumbnails?: string;
  onPlay?: () => void;
  onPause?: () => void;
  children?: React.ReactNode;
  muted?: boolean;
  autoPlay?: boolean;
  servers?: Array<{ id: StreamServerId; name: string }>;
  activeServerId?: StreamServerId | null;
  onServerChange?: (id: StreamServerId) => void;
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

const PIPToggle = () => {
  const isPictureInPicture = useMediaState("pictureInPicture");

  return (
    <PIPButton
      className={`vds-button h-full aspect-square flex items-center justify-center transition-colors duration-150 mr-1.5 cursor-pointer ${
        isPictureInPicture ? "text-violet-400 hover:text-violet-300" : "text-slate-300 hover:text-white"
      }`}
      title="Picture-in-Picture"
      aria-label="Toggle Picture-in-Picture"
    >
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" />
        <rect x="13" y="11" width="7" height="5" rx="1" fill="currentColor" stroke="currentColor" />
      </svg>
    </PIPButton>
  );
};

export const VideoPlayer = forwardRef<MediaPlayerInstance, VideoPlayerProps>(
  ({ src, title, isIframe = false, blockIframePopups = true, thumbnails, onPlay, onPause, children, muted = false, autoPlay = false, servers = [], activeServerId, onServerChange }, ref) => {
    const playableSrc = resolvePlayableSrc(src, isIframe);
    const [objectFit, setObjectFit] = useState<"contain" | "fill">(() => {
      if (typeof window === "undefined") return "contain";
      const isMobileViewport =
        window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(pointer: coarse)").matches;
      return isMobileViewport ? "fill" : "contain";
    });
    const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
    const playerRef = useRef<MediaPlayerInstance>(null);

    useEffect(() => {
      const playerEl = playerRef.current;
      if (!playerEl) return;

      const playerElAny = playerEl as unknown as { setAttribute?: (name: string, value: string) => void; el?: HTMLElement };
      if (typeof playerElAny.setAttribute === "function") {
        playerElAny.setAttribute("data-fit", objectFit);
      }
      const rawEl = playerElAny.el;
      if (rawEl && typeof rawEl.setAttribute === "function") {
        rawEl.setAttribute("data-fit", objectFit);
      }
    }, [objectFit]);

    useImperativeHandle(ref, () => playerRef.current!);

    const handleManualServerChange = (serverId: StreamServerId) => {
      onServerChange?.(serverId);
    };

    const toggleFit = () => {
      setObjectFit((prev) => (prev === "contain" ? "fill" : "contain"));
    };

    if (isIframe) {
      const iframeSandbox = blockIframePopups
        ? "allow-same-origin allow-scripts allow-forms allow-presentation"
        : "allow-same-origin allow-scripts allow-forms allow-presentation allow-popups";

      return (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-violet-500/30 group">
          <iframe
            key={src}
            src={playableSrc}
            title={title}
            className="h-full w-full border-0 bg-black"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox={iframeSandbox}
          />

          {children}
        </div>
      );
    }

    const handleProviderChange = (provider: MediaProviderAdapter | null) => {
      if (isHLSProvider(provider)) {
        provider.library = () => import("hls.js");
        provider.config = {
          liveSyncDuration: 25,
          liveMaxLatencyDuration: 50,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          abrEwmaDefaultEstimate: 300000,
          enableWorker: true,
          lowLatencyMode: false,
          manifestLoadingMaxRetry: 10,
          manifestLoadingRetryDelay: 1000,
          levelLoadingMaxRetry: 10,
          levelLoadingRetryDelay: 1000,
          fragLoadingMaxRetry: 10,
          fragLoadingRetryDelay: 1000,
          nudgeOffset: 0.2,
          nudgeMaxRetry: 5,
        };
      }
    };

    return (
      <div
        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-violet-500/30 group"
      >
        <MediaPlayer
          key={activeServerId ?? playableSrc}
          className="w-full h-full select-none outline-none relative"
          title={title}
          src={playableSrc}
          crossOrigin="anonymous"
          playsInline
          streamType="live"
          logLevel="silent"
          ref={playerRef}
          onPlay={onPlay}
          onPause={onPause}
          onProviderChange={handleProviderChange}
          data-fit={objectFit}
          muted={muted}
          autoPlay={autoPlay}
        >
          <MediaProvider />

          <DefaultVideoLayout
            thumbnails={thumbnails}
            icons={defaultLayoutIcons}
            menuGroup="bottom"
            smallLayoutWhen={false}
            slots={{
              timeSlider: null,
              googleCastButton: null,
              pipButton: null,
              beforeFullscreenButton: (
                <div className="flex items-center">
                  {servers.length > 1 && onServerChange && (
                    <div className="relative flex items-center h-full">
                      <button
                        onClick={() => setIsServerMenuOpen((prev) => !prev)}
                        className="vds-button h-full aspect-square flex items-center justify-center text-slate-300 hover:text-white transition-colors duration-150 mr-1.5 cursor-pointer relative"
                        title="Select Stream Server"
                        aria-label="Select stream server"
                      >
                        <Server className="w-[18px] h-[18px]" />
                        {activeServerId && (
                          <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[#0f0f13]">
                            {activeServerId}
                          </span>
                        )}
                      </button>

                      {isServerMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsServerMenuOpen(false);
                            }}
                          />
                          <div className="absolute bottom-full right-0 mb-2 bg-[#0f0f13]/95 backdrop-blur-md border border-white/10 rounded-xl px-0.5 py-1 shadow-2xl flex flex-col gap-0.5 min-w-[128px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <span className="px-1.5 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1 select-none">
                              Servers
                            </span>
                            {servers.map((srv) => (
                              <button
                                key={srv.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleManualServerChange(srv.id);
                                  setIsServerMenuOpen(false);
                                }}
                                className={`w-full px-1.5 py-1.5 text-left text-[11px] font-medium rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${activeServerId === srv.id
                                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20"
                                  : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
                                  }`}
                              >
                                <span>{srv.name}</span>
                                {activeServerId === srv.id && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <PIPToggle />
                  <button
                    onClick={toggleFit}
                    className={`vds-button h-full aspect-square flex items-center justify-center transition-colors duration-150 mr-1.5 cursor-pointer ${
                      objectFit === "fill" ? "text-violet-400 hover:text-violet-300" : "text-slate-300 hover:text-white"
                    }`}
                    title={objectFit === "contain" ? "Stretch to Fill" : "Fit to Screen"}
                    aria-label="Toggle scaling mode"
                  >
                    <Crop className="w-[18px] h-[18px]" />
                  </button>
                </div>
              ),
            }}
          />
          {children}
        </MediaPlayer>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
