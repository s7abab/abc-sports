"use client";

import React, { useEffect, useState, useRef } from "react";

interface FloatingComment {
  id: string;
  author: string;
  body: string;
  timestamp: number;
}

interface FloatingChatProps {
  isChatOverlayOpen?: boolean;
}

export function FloatingChat({ isChatOverlayOpen = false }: FloatingChatProps) {
  const [comments, setComments] = useState<FloatingComment[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleComment = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string; author: string; body: string }>;
      if (!customEvent.detail || !customEvent.detail.body || !customEvent.detail.id) return;

      const { id, author, body } = customEvent.detail;

      // Rate limit to at most 1 comment every 250ms to prevent flooding
      const now = Date.now();
      if (now - lastSpawnTimeRef.current < 250) {
        return;
      }
      lastSpawnTimeRef.current = now;

      const newComment: FloatingComment = {
        id,
        author,
        body,
        timestamp: now,
      };

      // Keep only the most recent 4 comments
      setComments((prev) => [...prev.slice(-3), newComment]);
    };

    window.addEventListener("live-chat-comment", handleComment);
    return () => {
      window.removeEventListener("live-chat-comment", handleComment);
    };
  }, []);

  // Periodic cleanup of comments older than 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setComments((prev) => prev.filter((c) => now - c.timestamp < 5000));
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`absolute bottom-16 z-40 flex flex-col items-end gap-2 pointer-events-none select-none overflow-hidden max-w-[240px] sm:max-w-[280px] transition-all duration-300 ${
        isChatOverlayOpen
          ? "right-[340px] md:right-[400px] max-sm:right-4"
          : "right-4"
      }`}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes commentSlideIn {
          0% {
            transform: translateY(16px) scale(0.95);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes commentFadeOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-8px);
          }
        }
        .floating-comment-item {
          animation: commentSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                     commentFadeOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) 4.6s forwards;
          background: rgba(15, 17, 21, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          will-change: transform, opacity;
        }
      `}} />
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="floating-comment-item rounded-xl px-3 py-1.5 flex flex-col gap-0.5 max-w-full text-left"
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 truncate">
            {comment.author}
          </span>
          <p className="text-xs leading-relaxed text-slate-100 break-words font-medium">
            {comment.body}
          </p>
        </div>
      ))}
    </div>
  );
}
