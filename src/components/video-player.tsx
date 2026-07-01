"use client";

import { MediaPlayer, MediaProvider, Poster, isHLSProvider, type MediaPlayerInstance, type MediaProviderAdapter } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { forwardRef, useState } from "react";

interface VideoPlayerProps {
  src: string;
  title: string;
  poster?: string;
  thumbnails?: string;
  onPlay?: () => void;
  onPause?: () => void;
  children?: React.ReactNode;
}

export const VideoPlayer = forwardRef<MediaPlayerInstance, VideoPlayerProps>(
  ({ src, title, poster, thumbnails, onPlay, onPause, children }, ref) => {
    const [objectFit, setObjectFit] = useState<"contain" | "cover">("contain");

    const fitClass = objectFit === "cover" 
      ? "[&_video]:!object-cover [&_img]:!object-cover" 
      : "[&_video]:!object-contain [&_img]:!object-contain";

    const toggleFit = () => {
      setObjectFit((prev) => (prev === "contain" ? "cover" : "contain"));
    };

    const handleProviderChange = (provider: MediaProviderAdapter | null) => {
      if (isHLSProvider(provider)) {
        provider.config = {
          liveSyncDuration: 5, // Keep 5 seconds delay in live HLS stream
        };
      }
    };

    return (
      <div className={`relative w-full aspect-video rounded-2xl overflow-hidden bg-black/95 border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-violet-500/30 group ${fitClass}`}>
        <MediaPlayer
          className="w-full h-full object-cover select-none outline-none"
          title={title}
          src={src}
          crossOrigin="anonymous"
          playsInline
          streamType="live"
          ref={ref}
          onPlay={onPlay}
          onPause={onPause}
          onProviderChange={handleProviderChange}
        >
          <MediaProvider>
            {poster && (
              <Poster
                src={poster}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover opacity-0 data-[visible]:opacity-100 transition-opacity duration-500 z-10"
              />
            )}
          </MediaProvider>
          <DefaultVideoLayout
            thumbnails={thumbnails}
            icons={defaultLayoutIcons}
            slots={{
              beforeFullscreenButton: (
                <button
                  onClick={toggleFit}
                  className="vds-button h-full aspect-square flex items-center justify-center text-slate-300 hover:text-white transition-colors duration-150 mr-1.5"
                  title={objectFit === "contain" ? "Fill Screen (Cover)" : "Fit Screen (Contain)"}
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
                      {/* Fill Icon: full cover scaling indicator */}
                      <rect x="2" y="5" width="20" height="14" rx="2" fill="currentColor" stroke="currentColor" />
                      <path d="M6 12h12M12 6v12" stroke="black" strokeWidth={2.5} strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              )
            }}
          />
          {children}
        </MediaPlayer>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
