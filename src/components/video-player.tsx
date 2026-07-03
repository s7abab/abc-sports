"use client";

import { MediaPlayer, MediaProvider, PIPButton, isHLSProvider, useMediaStore, useMediaState, type MediaPlayerInstance, type MediaProviderAdapter } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { forwardRef, useState, useRef, useImperativeHandle, useEffect } from "react";
import { Server, Loader2, Crop, RefreshCw, AlertTriangle } from "lucide-react";
import { useLiveStreamController } from "@/hooks/use-live-stream-controller";
import type { StreamServerId } from "@/lib/stream-health";

interface VideoPlayerProps {
  src: string;
  title: string;
  thumbnails?: string;
  onPlay?: () => void;
  onPause?: () => void;
  children?: React.ReactNode;
  muted?: boolean;
  autoPlay?: boolean;
  playerId?: string;
  servers?: Array<{ id: StreamServerId; name: string }>;
  activeServerId?: StreamServerId | null;
  onServerChange?: (id: StreamServerId) => void;
  isAutoSwitchEnabled?: boolean;
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
  ({ src, title, thumbnails, onPlay, onPause, children, muted = false, autoPlay = false, playerId, servers = [], activeServerId, onServerChange, isAutoSwitchEnabled = true }, ref) => {
    const [objectFit, setObjectFit] = useState<"contain" | "cover" | "fill">(() => {
      if (typeof window === "undefined") return "contain";
      return window.matchMedia("(max-width: 640px), (pointer: coarse)").matches ? "fill" : "contain";
    });
    const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
    const playerRef = useRef<MediaPlayerInstance>(null);

    useEffect(() => {
      const playerEl = playerRef.current;
      if (playerEl) {
        const playerElAny = playerEl as unknown as {
          setAttribute?: (name: string, value: string) => void;
          el?: HTMLElement;
        };
        if (typeof playerElAny.setAttribute === "function") {
          playerElAny.setAttribute("data-fit", objectFit);
        }
        const rawEl = playerElAny.el;
        if (rawEl && typeof rawEl.setAttribute === "function") {
          rawEl.setAttribute("data-fit", objectFit);
        }
      }
    }, [objectFit]);

    // Forward the ref to the parent component
    useImperativeHandle(ref, () => playerRef.current!);

    const {
      waiting,
      error,
      playing,
      canPlay,
      currentTime,
      bufferedEnd,
      seekableEnd,
    } = useMediaStore(playerRef);
    const [loadingTimeout, setLoadingTimeout] = useState(false);
    const [userClickedShowOverlay, setUserClickedShowOverlay] = useState(false);

    const {
      allStreamsFailed,
      autoSwitchingTo,
      countdown,
      failedServerIds,
      finalSrc,
      handleManualServerChange,
      handleRefresh,
      nextServerName,
      recordHlsError,
      sourceVersion,
      statusMessage,
      statusTitle,
    } = useLiveStreamController({
      src,
      playerId,
      playerRef,
      servers,
      activeServerId: activeServerId ?? null,
      onServerChange,
      isAutoSwitchEnabled,
      canPlay,
      waiting,
      playing,
      error,
      currentTime,
      bufferedEnd,
      seekableEnd,
    });

    useEffect(() => {
      if (canPlay) {
        const resetTimer = window.setTimeout(() => {
          setLoadingTimeout(false);
          setUserClickedShowOverlay(false);
        }, 0);
        return () => window.clearTimeout(resetTimer);
      }

      const resetTimer = window.setTimeout(() => {
        setLoadingTimeout(false);
      }, 0);
      const timer = window.setTimeout(() => {
        setLoadingTimeout(true);
      }, 2500);

      return () => {
        window.clearTimeout(resetTimer);
        window.clearTimeout(timer);
      };
    }, [canPlay, src]);

    const toggleFit = () => {
      setObjectFit((prev) => {
        if (prev === "contain") return "cover";
        if (prev === "cover") return "fill";
        return "contain";
      });
    };

    const handleProviderChange = (provider: MediaProviderAdapter | null) => {
      if (isHLSProvider(provider)) {
        provider.library = () => import("hls.js");
        provider.config = {
          liveSyncDuration: 25, // Target sync latency of 25s for slow connections so it can build buffer
          liveMaxLatencyDuration: 50, // Allow up to 50s latency before forcing catch-up
          maxBufferLength: 60, // Store up to 60s of buffer in memory for stability on slow connections
          maxMaxBufferLength: 120, // Max buffer length 120s
          abrEwmaDefaultEstimate: 300000, // Conservative initial bandwidth estimate (300 Kbps)
          enableWorker: true, // Use a web worker for parsing to keep UI responsive
          lowLatencyMode: false, // Prioritize stability/buffering over ultra-low delay
          manifestLoadingMaxRetry: 10,
          manifestLoadingRetryDelay: 1000,
          levelLoadingMaxRetry: 10,
          levelLoadingRetryDelay: 1000,
          fragLoadingMaxRetry: 10,
          fragLoadingRetryDelay: 1000,
          nudgeOffset: 0.2, // If stuck/stalled, nudge playback forward by 0.2s
          nudgeMaxRetry: 5,
        };

        provider.onInstance((hls) => {
          const hlsAny = hls as unknown as {
            on?: (event: string, callback: (_event: string, data: unknown) => void) => void;
            off?: (event: string, callback: (_event: string, data: unknown) => void) => void;
          };

          const onError = (_event: string, data: unknown) => {
            recordHlsError(data as { fatal?: boolean; type?: string; details?: string });
          };

          hlsAny.on?.("hlsError", onError);
          return () => hlsAny.off?.("hlsError", onError);
        });
      }
    };

    return (
      <div 
        onClick={() => {
          if (!canPlay) {
            setUserClickedShowOverlay(true);
          }
        }}
        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-violet-500/30 group"
      >
        <MediaPlayer
          key={`${activeServerId ?? finalSrc}:${finalSrc}:${sourceVersion}`}
          className="w-full h-full select-none outline-none relative"
          title={title}
          src={finalSrc}
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
                                className={`w-full px-1.5 py-1.5 text-left text-[11px] font-medium rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
                                  activeServerId === srv.id
                                    ? "bg-violet-600/20 text-violet-400 border border-violet-500/20"
                                    : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
                                }`}
                              >
                                <span>{srv.name}</span>
                                {activeServerId === srv.id && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                )}
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
                      objectFit === "cover"
                        ? "text-emerald-400 hover:text-emerald-300"
                        : objectFit === "fill"
                        ? "text-violet-400 hover:text-violet-300"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title={
                      objectFit === "contain"
                        ? "Fit Screen (Letterbox)"
                        : objectFit === "cover"
                        ? "Zoom to Fill (Crop)"
                        : "Stretch to Fill (Distort)"
                    }
                    aria-label="Toggle scaling mode"
                  >
                    <Crop className="w-[18px] h-[18px]" />
                  </button>
                </div>
              )
            }}
          />

          {/* ABC Sports watermark shown in the top-right corner. */}
          {true && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none animate-in fade-in duration-500">
              <div className={`relative pointer-events-none transition-all duration-350 ${
                objectFit === "contain"
                  ? "w-full aspect-video max-h-full"
                  : "w-full h-full"
              }`}>
                <div className="absolute top-[1%] right-[1%] pointer-events-none">
                  <div className="flex items-center gap-[clamp(4px,0.5vw,8px)] px-[clamp(10px,1.2vw,16px)] py-[clamp(5px,0.8vw,10px)] rounded-[clamp(6px,0.8vw,10px)] bg-slate-950/95 backdrop-blur-md border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.55)] transition-all duration-300 hover:border-violet-500/30">
                    <div className="w-[clamp(14px,1.5vw,18px)] h-[clamp(14px,1.5vw,18px)] rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-[clamp(8px,1vw,10px)] font-black text-white shrink-0 shadow-sm tracking-tighter select-none">
                      A
                    </div>
                    <span className="text-[clamp(10px,1.2vw,14px)] font-black tracking-widest uppercase shrink-0 select-none">
                      <span className="text-slate-100">abc</span>{" "}
                      <span className="text-violet-400">sports</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slow connection overlay warning */}
          {!allStreamsFailed && countdown !== null && countdown <= 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 pointer-events-none select-none animate-in fade-in duration-300">
              <div className="mx-3 w-[min(92vw,340px)] bg-[#0f0f13]/95 backdrop-blur border border-white/10 rounded-2xl p-4 sm:p-5 md:p-6 text-center shadow-2xl flex flex-col items-center gap-2.5 sm:gap-3 pointer-events-auto">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse relative mb-0.5 sm:mb-1">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  {/* Countdown number badge inside the alert */}
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-[#0f0f13] text-[9px] sm:text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-[#0f0f13] shadow-md">
                    {countdown}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-xs sm:text-sm md:text-base font-bold text-slate-200">Slow Connection</h4>
                  <p className="text-[11px] sm:text-xs md:text-sm leading-relaxed text-slate-400 text-balance">
                    {nextServerName ? (
                      <>
                        <span className="sm:hidden">Switching to <span className="font-semibold text-violet-400 break-words">{nextServerName}</span> in <span className="font-bold text-amber-400">{countdown}s</span> if needed.</span>
                        <span className="hidden sm:inline">Building buffer. Switching to <span className="font-semibold text-violet-400 break-words">{nextServerName}</span> in <span className="font-bold text-amber-400">{countdown}s</span> if needed...</span>
                      </>
                    ) : (
                      <>Recovering stream in <span className="font-bold text-amber-400">{countdown}s</span>...</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Auto switching notification */}
          {!allStreamsFailed && autoSwitchingTo && (
            <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-auto sm:right-4 sm:w-[320px] bg-violet-950/90 backdrop-blur border border-violet-500/20 text-white rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-3.5 shadow-2xl z-30 animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                <Loader2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-xs md:text-sm font-bold">Switching Server</p>
                <p className="text-[10px] sm:text-[11px] md:text-xs text-slate-300 truncate">
                  Loading {autoSwitchingTo}...
                </p>
              </div>
            </div>
          )}

          {/* Custom Loading, Error and Servers Overlay */}
          {!canPlay && (loadingTimeout || error || allStreamsFailed || userClickedShowOverlay) && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 flex flex-col items-center justify-start sm:justify-center bg-black/90 backdrop-blur-sm z-40 animate-in fade-in duration-300 px-3 py-2.5 sm:p-6 text-center select-none pointer-events-auto overflow-y-auto"
            >
              <div className="w-full max-w-[92vw] sm:max-w-sm shrink-0">
                <div className="mx-auto w-9 h-9 sm:w-16 sm:h-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-1.5 sm:mb-4 animate-pulse">
                  {allStreamsFailed || error ? (
                    <AlertTriangle className="w-5 h-5 sm:w-8 sm:h-8 text-rose-500" />
                  ) : (
                    <Loader2 className="w-5 h-5 sm:w-8 sm:h-8 text-violet-400 animate-spin" />
                  )}
                </div>

                <h3 className="text-[13px] sm:text-base md:text-lg font-bold text-slate-100 mb-1 sm:mb-2 text-balance leading-tight">
                  {countdown !== null && !allStreamsFailed
                    ? `${statusTitle} (${countdown}s)`
                    : statusTitle}
                </h3>

                <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 mb-2.5 sm:mb-6 leading-snug sm:leading-relaxed text-balance">
                  <span className="sm:hidden">
                    {allStreamsFailed
                      ? "All servers unavailable. Refresh or choose one."
                      : countdown !== null && nextServerName
                      ? `Switching to ${nextServerName} in ${countdown}s if needed.`
                      : "Building buffer. Wait, refresh, or switch server."}
                  </span>
                  <span className="hidden sm:inline">{statusMessage}</span>
                </p>
              </div>

              {/* Server selector buttons directly inside the overlay */}
              {servers.length > 0 && (
                <div className="mb-2.5 sm:mb-6 w-full max-w-xs flex flex-col gap-1.5 sm:gap-2 shrink-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    Select Stream Server
                  </span>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
                    {servers.map((srv) => (
                      <button
                        key={srv.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManualServerChange(srv.id);
                        }}
                        className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-lg sm:rounded-xl border transition-all duration-200 cursor-pointer max-w-[8rem] truncate ${
                          activeServerId === srv.id
                            ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20"
                            : failedServerIds.has(srv.id)
                            ? "bg-rose-950/30 border-rose-500/30 text-rose-200 hover:bg-rose-950/50"
                            : "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {srv.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-row sm:flex-row items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
                <button
                  onClick={handleRefresh}
                  className="flex min-w-0 flex-1 sm:flex-none sm:w-auto items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-[10px] sm:text-xs md:text-sm font-semibold rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg shadow-violet-600/20 group cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-500 group-hover:rotate-180" />
                  <span className="truncate">Refresh</span>
                </button>

              </div>
            </div>
          )}

          {children}
        </MediaPlayer>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
