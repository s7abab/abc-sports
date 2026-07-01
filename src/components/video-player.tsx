"use client";

import { MediaPlayer, MediaProvider, Poster, isHLSProvider, useMediaPlayer, useMediaStore, type MediaPlayerInstance, type MediaProviderAdapter } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { forwardRef, useState, useRef, useImperativeHandle, useEffect } from "react";
import { MessageSquare, MessageSquareOff, Server } from "lucide-react";
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
    const [objectFit, setObjectFit] = useState<"contain" | "fill">("contain");
    const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
    const playerRef = useRef<MediaPlayerInstance>(null);

    // Forward the ref to the parent component
    useImperativeHandle(ref, () => playerRef.current!);

    // Subscribe to Vidstack's media store state (like fullscreen and waiting)
    const { fullscreen, waiting } = useMediaStore(playerRef);
    const [showSlowWarning, setShowSlowWarning] = useState(false);

    useEffect(() => {
      let timer: NodeJS.Timeout;
      if (waiting) {
        // If waiting lasts for more than 4 seconds, show the warning
        timer = setTimeout(() => {
          setShowSlowWarning(true);
        }, 4000);
      } else {
        setShowSlowWarning(false);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [waiting]);

    const toggleFit = () => {
      setObjectFit((prev) => (prev === "contain" ? "fill" : "contain"));
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
                    className="vds-button h-full aspect-square flex items-center justify-center text-slate-300 hover:text-white transition-colors duration-150 mr-1.5 cursor-pointer"
                    title={objectFit === "contain" ? "Fill Screen (Stretch)" : "Fit Screen (Contain)"}
                    aria-label="Toggle Fit/Fill scaling"
                  >
                    {objectFit === "contain" ? (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {/* Fit Icon: letterboxed video indicator */}
                        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeDasharray="3 3" />
                        <rect x="5" y="8" width="14" height="8" rx="1" fill="currentColor" stroke="currentColor" />
                      </svg>
                    ) : (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {/* Fill Icon: full stretched indicator */}
                        <rect x="2" y="5" width="20" height="14" rx="2" fill="currentColor" stroke="currentColor" />
                        <path d="M6 12h12M12 6v12" stroke="black" strokeWidth={2.5} strokeLinecap="round" />
                      </svg>
                    )}
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
          {showSlowWarning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 pointer-events-none select-none animate-in fade-in duration-300">
              <div className="bg-[#0f0f13]/95 backdrop-blur border border-white/10 rounded-2xl p-4 text-center max-w-[280px] shadow-2xl flex flex-col items-center gap-2 pointer-events-auto">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <h4 className="text-xs font-bold text-slate-200">Slow Connection</h4>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  The stream buffer is catch-up loading. If it doesn't resume, try selecting another server.
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

