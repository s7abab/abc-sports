"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  platforms: string[];
  userChoice: Promise<BeforeInstallPromptChoice>;
  prompt: () => Promise<void>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const INSTALL_PROMPT_DISMISSED_KEY = "abc-sports-install-prompt-dismissed-at";
const INSTALL_PROMPT_SNOOZE_MS = 1000 * 60 * 60 * 24 * 7;

function isPromptSnoozed() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < INSTALL_PROMPT_SNOOZE_MS;
  } catch {
    return false;
  }
}

function snoozePrompt() {
  try {
    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures; the prompt can still be dismissed for this session.
  }
}

function isStandaloneApp() {
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isIosSafariLike() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isWebKit = /safari/.test(userAgent);
  const isChromiumIos = /crios|fxios|edgios/.test(userAgent);

  return isIos && isWebKit && !isChromiumIos;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneApp() || isPromptSnoozed()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowIosHint(false);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setInstallEvent(null);
      setIsVisible(false);
      snoozePrompt();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const iosHintTimer = window.setTimeout(() => {
      if (isIosSafariLike() && !isStandaloneApp()) {
        setShowIosHint(true);
        setIsVisible(true);
      }
    }, 1400);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.clearTimeout(iosHintTimer);
    };
  }, []);

  const dismiss = () => {
    snoozePrompt();
    setIsVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;

    setIsInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
      dismiss();
    } finally {
      setIsInstalling(false);
    }
  };

  if (!isVisible || (!installEvent && !showIosHint)) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[24rem] sm:px-0 sm:pb-0">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c1018]/95 p-5 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_34%)]" />
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="relative pr-10">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/15 text-red-200">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200">
            Install ABC Sports
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight">
            Open live sports like an app.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Add ABC Sports to your home screen for faster access to fixtures, players, and live
            streams.
          </p>

          {installEvent ? (
            <button
              type="button"
              onClick={install}
              disabled={isInstalling}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01] hover:bg-red-100 disabled:cursor-wait disabled:opacity-70"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {isInstalling ? "Opening install..." : "Install app"}
            </button>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left text-sm leading-6 text-slate-300">
              <div className="mb-2 flex items-center gap-2 font-bold text-white">
                <Share className="h-4 w-4" aria-hidden="true" />
                iPhone or iPad
              </div>
              Tap Share, then choose <span className="font-bold text-red-100">Add to Home Screen</span>.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
