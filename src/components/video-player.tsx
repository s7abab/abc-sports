"use client";

import { MediaPlayer, MediaProvider, Poster, isHLSProvider, useMediaPlayer, useMediaStore, type MediaPlayerInstance, type MediaProviderAdapter } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { forwardRef, useState, useRef, useImperativeHandle, useEffect } from "react";
import { MessageSquare, MessageSquareOff, Server, Loader2, Crop } from "lucide-react";
import { LiveMatchChat } from "@/components/live-match-chat";

interface VideoPlayerProps {
  src: string;
  title: string;
  poster?: string;
  thumbnails?: string;
  onPlay?: () => void;
  onPause?: () => void;
  children?: React.ReactNode;
  muted?: boolean;
  autoPlay?: boolean;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  playerId?: string;
  isMobile?: boolean;
  servers?: Array<{ id: "1" | "2" | "3" | "4"; name: string }>;
  activeServerId?: "1" | "2" | "3" | "4" | null;
  onServerChange?: (id: "1" | "2" | "3" | "4") => void;
}

const PIPToggle = () => {
  const player = useMediaPlayer();

  const togglePIP = async () => {
    if (!player) return;
    try {
      if (player.state.pictureInPicture) {
        await player.exitPictureInPicture();
      } else {
        await player.enterPictureInPicture();
      }
    } catch (e) {
      console.error("Failed to toggle PiP:", e);
    }
  };

  return (
    <button
      onClick={togglePIP}
      className="vds-button h-full aspect-square flex items-center justify-center text-slate-300 hover:text-white transition-colors duration-150 mr-1.5 cursor-pointer"
      title="Picture-in-Picture"
      aria-label="Toggle Picture-in-Picture"
    >
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" />
        <rect x="13" y="11" width="7" height="5" rx="1" fill="currentColor" stroke="currentColor" />
      </svg>
    </button>
  );
};

export const VideoPlayer = forwardRef<MediaPlayerInstance, VideoPlayerProps>(
  ({ src, title, poster, thumbnails, onPlay, onPause, children, muted = false, autoPlay = false, isChatOpen = false, onToggleChat, playerId, isMobile = false, servers = [], activeServerId, onServerChange }, ref) => {
    const [objectFit, setObjectFit] = useState<"contain" | "cover" | "fill">("contain");
    const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
    const playerRef = useRef<MediaPlayerInstance>(null);

    useEffect(() => {
      const playerEl = playerRef.current;
      if (playerEl) {
        const playerElAny = playerEl as any;
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

    const { fullscreen, waiting } = useMediaStore(playerRef);
    const [autoSwitchingTo, setAutoSwitchingTo] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [nextServerName, setNextServerName] = useState<string | null>(null);

    useEffect(() => {
      let intervalId: NodeJS.Timeout;

      if (waiting) {
        if (servers.length > 1 && activeServerId && onServerChange) {
          const currentIdx = servers.findIndex((s) => s.id === activeServerId);
          if (currentIdx !== -1) {
            const nextIdx = (currentIdx + 1) % servers.length;
            const nextServer = servers[nextIdx];
            setNextServerName(nextServer.name);

            let localCountdown = 10;
            setCountdown(localCountdown);

            intervalId = setInterval(() => {
              localCountdown -= 1;
              if (localCountdown >= 0) {
                setCountdown(localCountdown);
              }
              if (localCountdown === 0) {
                clearInterval(intervalId);
                setAutoSwitchingTo(nextServer.name);
                onServerChange(nextServer.id);
                setCountdown(null);
                setNextServerName(null);

                // Auto-dismiss switching HUD after 4 seconds
                setTimeout(() => {
                  setAutoSwitchingTo(null);
                }, 4000);
              }
            }, 1000);
          }
        }
      } else {
        setCountdown(null);
        setNextServerName(null);
      }

      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }, [waiting, servers, activeServerId, onServerChange]);

    const toggleFit = () => {
      setObjectFit((prev) => {
        if (prev === "contain") return "cover";
        if (prev === "cover") return "fill";
        return "contain";
      });
    };

    const handleProviderChange = (provider: MediaProviderAdapter | null) => {
      if (isHLSProvider(provider)) {
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
      }
    };

    const showOverlayChat = isChatOpen && (isMobile || fullscreen);

    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-violet-500/30 group">
        <MediaPlayer
          className="w-full h-full select-none outline-none relative"
          title={title}
          src={src}
          crossOrigin="anonymous"
          playsInline
          streamType="live"
          ref={playerRef}
          onPlay={onPlay}
          onPause={onPause}
          onProviderChange={handleProviderChange}
          data-fit={objectFit}
          muted={muted}
          autoPlay={autoPlay}
        >
          <MediaProvider>
            {poster && (
              <Poster
                src={poster}
                alt={title}
                className="absolute inset-0 w-full h-full opacity-0 data-[visible]:opacity-100 transition-opacity duration-500 z-10 pointer-events-none"
              />
            )}
          </MediaProvider>
          <DefaultVideoLayout
            thumbnails={thumbnails}
            icons={defaultLayoutIcons}
            slots={{
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
                          <div className="absolute bottom-full right-0 mb-2 bg-[#0f0f13]/95 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 min-w-[120px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <span className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1 select-none">
                              Servers
                            </span>
                            {servers.map((srv) => (
                              <button
                                key={srv.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onServerChange(srv.id);
                                  setIsServerMenuOpen(false);
                                }}
                                className={`w-full px-2 py-1.5 text-left text-[11px] font-medium rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
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
                  {onToggleChat && (
                    <button
                      onClick={onToggleChat}
                      className="vds-button h-full aspect-square flex items-center justify-center text-slate-300 hover:text-white transition-colors duration-150 mr-1.5 cursor-pointer"
                      title={isChatOpen ? "Hide Chat" : "Show Chat"}
                      aria-label="Toggle chat layout"
                    >
                      {isChatOpen ? (
                        <MessageSquareOff className="w-[18px] h-[18px] text-emerald-400" />
                      ) : (
                        <MessageSquare className="w-[18px] h-[18px]" />
                      )}
                    </button>
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

          {/* Chat Overlay inside the video player (rendered when chat is open and either on mobile or fullscreen) */}
          {showOverlayChat && playerId && (
            <div
              className="absolute inset-y-0 right-0 w-full sm:w-80 md:w-96 z-40 flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <LiveMatchChat
                playerId={playerId}
                roomTitle={title}
                isOverlay={true}
                onClose={onToggleChat}
              />
            </div>
          )}

          {/* Slow connection overlay warning */}
          {countdown !== null && countdown <= 6 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 pointer-events-none select-none animate-in fade-in duration-300">
              <div className="bg-[#0f0f13]/95 backdrop-blur border border-white/10 rounded-2xl p-5 md:p-6 text-center max-w-[340px] shadow-2xl flex flex-col items-center gap-3 pointer-events-auto">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse relative mb-1">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  {/* Countdown number badge inside the alert */}
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-[#0f0f13] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-[#0f0f13] shadow-md">
                    {countdown}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-sm md:text-base font-bold text-slate-200">Slow Connection</h4>
                  <p className="text-xs md:text-sm leading-relaxed text-slate-400">
                    Stream stalled. Switching to <span className="font-semibold text-violet-400">{nextServerName}</span> in <span className="font-bold text-amber-400">{countdown}s</span>...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Auto switching notification */}
          {autoSwitchingTo && (
            <div className="absolute top-4 left-4 right-4 sm:left-auto sm:w-[320px] bg-violet-950/90 backdrop-blur border border-violet-500/20 text-white rounded-xl p-4 flex items-center gap-3.5 shadow-2xl z-30 animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400">
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-bold">Switching Server</p>
                <p className="text-[11px] md:text-xs text-slate-300 truncate">
                  Stream stalled. Loading {autoSwitchingTo}...
                </p>
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

