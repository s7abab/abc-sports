"use client";

import React, { useEffect, useState, useRef } from "react";

interface FlyingEmoji {
  id: string;
  emoji: string;
  left: number; // horizontal start position in percentage (0 - 100)
  driftX1: number; // drift at 50% height in pixels
  driftX2: number; // drift at 100% height in pixels
  rotateMid: number; // rotation at 15% height in degrees
  rotateMid2: number; // rotation at 50% height in degrees
  rotateEnd: number; // rotation at 100% height in degrees
  scale: number; // target scale
  duration: number; // animation duration in seconds
}

interface FloatingReactionsProps {
  isChatOverlayOpen?: boolean;
}

export function FloatingReactions({ isChatOverlayOpen = false }: FloatingReactionsProps) {
  const [emojis, setEmojis] = useState<FlyingEmoji[]>([]);
  const [isFloatingEnabled, setIsFloatingEnabled] = useState(false);
  // Use refs to access the latest state, deduplicate, and throttle rendering
  const isChatOverlayOpenRef = useRef(isChatOverlayOpen);
  const seenIdsRef = useRef(new Set<string>());
  const lastSpawnTimeRef = useRef<number>(0);

  useEffect(() => {
    isChatOverlayOpenRef.current = isChatOverlayOpen;
  }, [isChatOverlayOpen]);

  useEffect(() => {
    // Read initial state from localStorage (disabled initially if not set or false)
    const stored = localStorage.getItem("live_chat_float_enabled");
    setIsFloatingEnabled(stored === "true");

    const handleToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      setIsFloatingEnabled(customEvent.detail.enabled);
    };

    window.addEventListener("live-chat-float-toggled", handleToggle);
    return () => {
      window.removeEventListener("live-chat-float-toggled", handleToggle);
    };
  }, []);

  useEffect(() => {
    const handleReaction = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string; emoji: string }>;
      if (!customEvent.detail || !customEvent.detail.emoji || !customEvent.detail.id) return;

      const { id, emoji } = customEvent.detail;
      
      // 1. Deduplicate to avoid rendering the same reaction multiple times
      if (seenIdsRef.current.has(id)) {
        return;
      }
      seenIdsRef.current.add(id);
      setTimeout(() => {
        seenIdsRef.current.delete(id);
      }, 10000);

      // 2. Receiver-side throttling to protect streaming performance:
      // Limit emoji spawning to at most 1 emoji per 120ms (approx. 8 reactions per second)
      const now = Date.now();
      if (now - lastSpawnTimeRef.current < 120) {
        return;
      }
      lastSpawnTimeRef.current = now;
      
      // Calculate spawn horizontal position.
      // If the overlay chat is open (takes up the right part of the screen),
      // we spawn emojis further to the left (e.g. 45% - 60% of player width) to avoid
      // being completely covered. If chat is closed, we spawn them in the bottom-right (75% - 90%).
      const left = isChatOverlayOpenRef.current
        ? 45 + Math.random() * 15 // 45% to 60%
        : 75 + Math.random() * 18; // 75% to 93%
      
      const newEmoji: FlyingEmoji = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        emoji,
        left,
        driftX1: (Math.random() - 0.5) * 50, // -25px to +25px mid-drift
        driftX2: (Math.random() - 0.5) * 110, // -55px to +55px end-drift
        rotateMid: (Math.random() - 0.5) * 35, // -17.5deg to +17.5deg
        rotateMid2: (Math.random() - 0.5) * 60, // -30deg to +30deg
        rotateEnd: (Math.random() - 0.5) * 80, // -40deg to +40deg
        scale: 0.65 + Math.random() * 0.3, // 0.65x to 0.95x scale (smaller & cleaner)
        duration: 2.4 + Math.random() * 1.2, // 2.4s to 3.6s float duration
      };

      // Keep max 15 emojis at a time in memory to prevent heavy DOM rendering.
      setEmojis((prev) => [...prev.slice(-15), newEmoji]);
    };

    window.addEventListener("live-chat-reaction", handleReaction);
    return () => {
      window.removeEventListener("live-chat-reaction", handleReaction);
    };
  }, []);

  if (!isFloatingEnabled) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50 reactions-overlay-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .reactions-overlay-container {
          container-type: size;
        }
        @keyframes floatUpAndWobble {
          0% {
            transform: translateY(105cqh) translateX(0) scale(0.2) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
            transform: translateY(80cqh) translateX(0) scale(var(--target-scale)) rotate(var(--rotate-mid));
          }
          50% {
            transform: translateY(40cqh) translateX(var(--drift-x-1)) scale(var(--target-scale)) rotate(var(--rotate-mid-2));
            opacity: 0.95;
          }
          80% {
            opacity: 0.75;
          }
          100% {
            transform: translateY(-10cqh) translateX(var(--drift-x-2)) scale(0.4) rotate(var(--rotate-end));
            opacity: 0;
          }
        }
        .flying-emoji-item {
          position: absolute;
          top: 0;
          will-change: transform, opacity;
          animation: floatUpAndWobble var(--duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          font-size: 1.5rem; /* Smaller size for cleaner layout */
          line-height: 1;
          user-select: none;
          filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.22));
        }
      `}} />
      {emojis.map((item) => (
        <span
          key={item.id}
          className="flying-emoji-item"
          style={{
            left: `${item.left}%`,
            "--duration": `${item.duration}s`,
            "--target-scale": item.scale,
            "--drift-x-1": `${item.driftX1}px`,
            "--drift-x-2": `${item.driftX2}px`,
            "--rotate-mid": `${item.rotateMid}deg`,
            "--rotate-mid-2": `${item.rotateMid2}deg`,
            "--rotate-end": `${item.rotateEnd}deg`,
          } as React.CSSProperties}
          onAnimationEnd={() => {
            setEmojis((prev) => prev.filter((e) => e.id !== item.id));
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}
