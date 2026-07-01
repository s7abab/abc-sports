"use client";

import { MediaPlayer, MediaProvider, Poster, isHLSProvider, useMediaPlayer, useMediaStore, type MediaPlayerInstance, type MediaProviderAdapter } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { forwardRef, useState, useRef, useImperativeHandle } from "react";
import { MessageSquare, MessageSquareOff } from "lucide-react";
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
  ({ src, title, poster, thumbnails, onPlay, onPause, children, muted = false, autoPlay = false, isChatOpen = false, onToggleChat, playerId, isMobile = false }, ref) => {
    const [objectFit, setObjectFit] = useState<"contain" | "fill">("contain");
    const playerRef = useRef<MediaPlayerInstance>(null);

    // Forward the ref to the parent component
    useImperativeHandle(ref, () => playerRef.current!);

    // Subscribe to Vidstack's media store state (like fullscreen)
    const { fullscreen } = useMediaStore(playerRef);

    const toggleFit = () => {
      setObjectFit((prev) => (prev === "contain" ? "fill" : "contain"));
    };

    const handleProviderChange = (provider: MediaProviderAdapter | null) => {
      if (isHLSProvider(provider)) {
        provider.config = {
          liveSyncDuration: 5, // Target sync latency of 5s
          liveMaxLatencyDuration: 15, // Allow up to 15s latency before forcing catch-up (helps absorb network drops)
          maxBufferLength: 30, // Store up to 30s of buffer in memory for stability on slow connections
          maxMaxBufferLength: 60,
          abrEwmaDefaultEstimate: 500000, // Start with a conservative initial bandwidth estimate (500 Kbps)
          enableWorker: true, // Use a web worker for parsing to keep UI responsive
          lowLatencyMode: false, // Prioritize stability/buffering over ultra-low delay
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

          {children}
        </MediaPlayer>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

