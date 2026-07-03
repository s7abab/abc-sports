"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const STREAM_URL =
  "https://qp-pldt-live-bpk-ucd-prod.akamaized.net/bpk-tv/fifa_ppv1/default/index.mpd";
const KEY_ID = "2c338a117d434ce4bbe3569231af90f1";
const CLEAR_KEY = "a9633d901ee8a3f4f58ac314b5c5f4fb";

type ShakaPlayer = {
  attach(video: HTMLVideoElement): Promise<void>;
  configure(config: Record<string, unknown>): void;
  load(uri: string): Promise<void>;
  destroy(): Promise<void>;
};

type ShakaUiOverlay = {
  configure(config: Record<string, unknown>): void;
  destroy(): Promise<void>;
};

type ShakaGlobal = {
  polyfill: {
    installAll(): void;
  };
  Player: {
    new (): ShakaPlayer;
    isBrowserSupported(): boolean;
  };
  ui: {
    Overlay: new (
      player: ShakaPlayer,
      container: HTMLElement,
      video: HTMLVideoElement
    ) => ShakaUiOverlay;
  };
};

declare global {
  interface Window {
    shaka?: ShakaGlobal;
  }
}

export function ShakaClearKeyPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);
  const whatsappRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setWhatsappUrl(data.whatsappUrl || "");
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!scriptReady || !videoRef.current || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let player: ShakaPlayer | null = null;
    let ui: ShakaUiOverlay | null = null;

    async function initPlayer() {
      const shaka = window.shaka;
      const videoEl = videoRef.current;
      const container = containerRef.current;
      const watermark = watermarkRef.current;

      if (!shaka) {
        setErrorMessage("Shaka Player failed to load.");
        return;
      }

      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        setErrorMessage("This browser does not support Shaka Player playback.");
        return;
      }

      if (!videoEl || !container) {
        return;
      }

      try {
        player = new shaka.Player();
        await player.attach(videoEl);

        if (cancelled) {
          await player.destroy();
          return;
        }

        ui = new shaka.ui.Overlay(player, container, videoEl);
        ui.configure({
          controlPanelElements: [
            "play_pause",
            "mute",
            "volume",
            "time_and_duration",
            "spacer",
            "language",
            "captions",
            "picture_in_picture",
            "quality",
            "fullscreen",
          ],
          seekBarColors: {
            base: "rgba(255,255,255,.32)",
            buffered: "rgba(255,255,255,.55)",
            played: "#00ff84",
          },
        });

        const playerConfig: Record<string, unknown> = {
          abr: {
            defaultBandwidthEstimate: 10000,
            enabled: true,
            switchInterval: 1,
          },
          manifest: {
            defaultPresentationDelay: 4,
            dash: {
              ignoreSuggestedPresentationDelay: true,
              ignoreMinBufferTime: true,
              autoCorrectDrift: true,
            },
          },
          streaming: {
            bufferingGoal: 8,
            rebufferingGoal: 2,
            bufferBehind: 10,
            lowLatencyMode: true,
            safeSeekOffset: 4,
            stallThreshold: 1,
            jumpLargeGaps: true,
          },
        };

        if (KEY_ID && CLEAR_KEY) {
          playerConfig.drm = {
            clearKeys: {
              [KEY_ID]: CLEAR_KEY,
            },
          };
        }

        player.configure(playerConfig);

        window.setTimeout(() => {
          if (!cancelled) {
            if (watermark && container.contains(watermark)) {
              container.appendChild(watermark);
            }
            const whatsappEl = whatsappRef.current;
            if (whatsappEl && container.contains(whatsappEl)) {
              container.appendChild(whatsappEl);
            }
          }
        }, 100);

        await player.load(STREAM_URL);
      } catch (error) {
        console.error("Shaka Player error:", error);
        setErrorMessage("Unable to load this stream.");
      }
    }

    void initPlayer();

    return () => {
      cancelled = true;
      const destroyUi = ui?.destroy();
      const destroyPlayer = player?.destroy();
      void Promise.allSettled([destroyUi, destroyPlayer]);
    };
  }, [scriptReady]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/shaka-player/dist/controls.css"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/shaka-player/dist/shaka-player.ui.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setErrorMessage("Unable to load Shaka Player script.")}
      />

      <div
        ref={containerRef}
        id="player-container"
        className="relative aspect-video w-full overflow-hidden rounded-[1.45rem] border border-black/60 bg-black shadow-inner shadow-black sm:rounded-[1.6rem]"
      >
        <video
          ref={videoRef}
          id="video"
          className="h-full w-full bg-black"
          autoPlay
          playsInline
          controls={false}
        />

        <div
          ref={whatsappRef}
          id="wa-btn"
          className="pointer-events-none absolute left-[clamp(4px,0.8vw,10px)] top-[1%] z-10 select-none"
        >
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto flex items-center gap-[clamp(4px,0.5vw,8px)] rounded-[clamp(6px,0.8vw,10px)] border border-[#25D366]/20 bg-[#25D366]/10 px-[clamp(8px,1vw,14px)] py-[clamp(4px,0.6vw,8px)] shadow-[0_4px_12px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all hover:scale-[1.03] hover:bg-[#25D366]/20 hover:border-[#25D366]/40 cursor-pointer text-white"
            >
              <svg className="h-[clamp(12px,1.4vw,16px)] w-[clamp(12px,1.4vw,16px)] fill-[#25D366]" viewBox="0 0 24 24">
                <path d="M12.031 2c-5.514 0-9.989 4.475-9.989 9.989 0 1.763.459 3.486 1.33 5.006L2 22l5.185-1.359a9.92 9.92 0 004.847 1.258c5.514 0 9.989-4.475 9.989-9.989S17.545 2 12.031 2zm0 18.294a8.276 8.276 0 01-4.222-1.157l-.303-.18-3.136.822.836-3.056-.197-.314a8.272 8.272 0 01-1.267-4.42c0-4.57 3.719-8.29 8.29-8.29 4.57 0 8.29 3.72 8.29 8.29s-3.72 8.29-8.29 8.29zM16.14 13.9c-.226-.113-1.337-.66-1.543-.736-.207-.076-.358-.113-.509.113-.15.226-.583.735-.715.885-.132.15-.263.17-.489.057a6.167 6.167 0 01-1.815-1.121 6.8 6.8 0 01-1.255-1.564c-.132-.226-.014-.348.099-.461.102-.102.226-.264.339-.396.113-.132.15-.226.226-.377.076-.15.038-.283-.019-.396-.056-.113-.509-1.225-.697-1.677-.183-.44-.369-.38-.509-.388a5.19 5.19 0 00-.433-.008c-.15 0-.396.056-.603.283-.207.226-.79.772-.79 1.883s.809 2.185.922 2.336c.113.15 1.59 2.429 3.854 3.407.538.232.959.371 1.287.475.54.172 1.03.148 1.417.09.433-.064 1.337-.546 1.525-1.074.189-.527.189-.979.132-1.074-.056-.095-.207-.15-.433-.264z" />
              </svg>
              <span className="text-[clamp(9px,1.1vw,12px)] font-black uppercase tracking-wider text-slate-100 select-none">
                Join WhatsApp
              </span>
            </a>
          )}
        </div>

        <div
          ref={watermarkRef}
          id="wm"
          className="pointer-events-none absolute right-[clamp(10px,1.5vw,20px)] top-[1%] z-10 select-none"
        >
          <div className="flex items-center gap-[clamp(4px,0.5vw,8px)] rounded-[clamp(6px,0.8vw,10px)] border border-white/10 bg-slate-950/95 px-[clamp(10px,1.2vw,16px)] py-[clamp(5px,0.8vw,10px)] shadow-[0_4px_12px_rgba(0,0,0,0.55)] backdrop-blur-md">
            <div className="flex h-[clamp(14px,1.5vw,18px)] w-[clamp(14px,1.5vw,18px)] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-[clamp(8px,1vw,10px)] font-black tracking-tighter text-white shadow-sm">
              A
            </div>
            <span className="shrink-0 text-[clamp(10px,1.2vw,14px)] font-black uppercase tracking-widest">
              <span className="text-slate-100">abc</span>{" "}
              <span className="text-violet-400">sports</span>
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/85 px-4 text-center">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-sm font-semibold text-rose-100 shadow-2xl">
              {errorMessage}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
