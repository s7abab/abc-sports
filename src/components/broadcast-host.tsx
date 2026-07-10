"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink, X } from "lucide-react";
import type { BroadcastMessage } from "@/lib/broadcast-storage";

const DISMISS_PREFIX = "broadcast-dismissed";

function normalizeBroadcast(value: unknown): BroadcastMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const broadcast = value as Partial<BroadcastMessage> & {
    imageUrls?: unknown;
    image_urls?: unknown;
    action_label?: unknown;
    cancel_label?: unknown;
    action_url?: unknown;
    is_active?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
  };

  const rawImageUrls = broadcast.imageUrls ?? broadcast.image_urls;
  const imageUrls = Array.isArray(rawImageUrls)
    ? rawImageUrls
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const title = typeof broadcast.title === "string" ? broadcast.title.trim() : "";
  const description = typeof broadcast.description === "string" ? broadcast.description.trim() : "";
  const actionLabel =
    typeof broadcast.actionLabel === "string"
      ? broadcast.actionLabel.trim()
      : typeof broadcast.action_label === "string"
        ? broadcast.action_label.trim()
        : "Open";
  const cancelLabel =
    typeof broadcast.cancelLabel === "string"
      ? broadcast.cancelLabel.trim()
      : typeof broadcast.cancel_label === "string"
        ? broadcast.cancel_label.trim()
        : "Close";
  const actionUrl =
    typeof broadcast.actionUrl === "string"
      ? broadcast.actionUrl.trim()
      : typeof broadcast.action_url === "string"
        ? broadcast.action_url.trim()
        : "";

  return {
    id: typeof broadcast.id === "string" && broadcast.id.trim() ? broadcast.id.trim() : "singleton",
    title,
    description,
    actionLabel: actionLabel || "Open",
    cancelLabel: cancelLabel || "Close",
    actionUrl,
    imageUrls,
    isActive: Boolean(broadcast.isActive ?? broadcast.is_active),
    createdAt:
      typeof broadcast.createdAt === "string"
        ? broadcast.createdAt
        : typeof broadcast.created_at === "string"
          ? broadcast.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof broadcast.updatedAt === "string"
        ? broadcast.updatedAt
        : typeof broadcast.updated_at === "string"
          ? broadcast.updated_at
          : new Date().toISOString(),
  };
}

function getDismissKey(message: BroadcastMessage) {
  return `${DISMISS_PREFIX}:${message.id}:${message.updatedAt}`;
}

function isDismissed(message: BroadcastMessage) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getDismissKey(message)) === "1";
}

function rememberDismissal(message: BroadcastMessage) {
  window.localStorage.setItem(getDismissKey(message), "1");
}

function shouldShowBroadcast(message: BroadcastMessage | null) {
  if (!message) return false;
  if (!message.isActive) return false;
  return Boolean(message.title || message.description || message.imageUrls.length > 0 || message.actionUrl);
}

function BroadcastModal({ message, onClose }: { message: BroadcastMessage; onClose: () => void }) {
  const hasImages = message.imageUrls.length > 0;
  const actionUrlIsValid = Boolean(message.actionUrl);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close broadcast"
        onClick={onClose}
      />

      <section className="relative z-[91] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0d11] text-slate-100 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-slate-200 transition hover:bg-white/10 hover:text-white"
          aria-label="Close broadcast popup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.22),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(9,9,11,0.98)_58%,rgba(6,78,59,0.24))] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.32em] text-violet-200/90">
            <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.85)]" />
            Broadcast
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div className="min-w-0">
              <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">
                {message.title || "Announcement"}
              </h2>
              {message.description && (
                <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-[15px]">
                  {message.description}
                </p>
              )}

              {(actionUrlIsValid || message.cancelLabel) && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {actionUrlIsValid && (
                    <a
                      href={message.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[#09090b] transition hover:scale-[1.02]"
                    >
                      <span>{message.actionLabel || "Open"}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10 hover:text-white"
                  >
                    {message.cancelLabel || "Close"}
                  </button>
                </div>
              )}
            </div>

            {hasImages && (
              <div className="grid gap-3">
                {message.imageUrls.length === 1 ? (
                  <img
                    src={message.imageUrls[0]}
                    alt={message.title || "Broadcast"}
                    className="h-full min-h-56 w-full rounded-[1.5rem] border border-white/10 object-cover"
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {message.imageUrls.map((url, index) => (
                      <img
                        key={`${url}-${index}`}
                        src={url}
                        alt={`${message.title || "Broadcast"} ${index + 1}`}
                        className={`w-full rounded-[1.25rem] border border-white/10 object-cover ${
                          index === 0 && message.imageUrls.length === 3 ? "sm:col-span-2 h-52" : "h-40"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function BroadcastHost() {
  const pathname = usePathname();
  const [broadcast, setBroadcast] = useState<BroadcastMessage | null>(null);

  const shouldRender = useMemo(() => !pathname.startsWith("/dashboard"), [pathname]);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    let cancelled = false;

    const applyBroadcast = (next: BroadcastMessage | null) => {
      if (cancelled) return;
      if (!next || !shouldShowBroadcast(next)) {
        setBroadcast(null);
        return;
      }

      if (isDismissed(next)) {
        setBroadcast(null);
        return;
      }

      setBroadcast(next);
    };

    async function fetchBroadcast() {
      try {
        const response = await fetch("/api/broadcast", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        applyBroadcast(normalizeBroadcast(data));
      } catch (error) {
        console.error("Error loading broadcast message:", error);
      }
    }

    fetchBroadcast();

    return () => {
      cancelled = true;
    };
  }, [shouldRender]);

  if (!shouldRender || !broadcast) {
    return null;
  }

  return (
    <BroadcastModal
      message={broadcast}
      onClose={() => {
        rememberDismissal(broadcast);
        setBroadcast(null);
      }}
    />
  );
}
