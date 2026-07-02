"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, MessageCircle, Send, Smile, UserRound, X } from "lucide-react";

import type { ChatMessage } from "@/lib/chat-storage";

interface LiveMatchChatProps {
  playerId: string;
  roomTitle: string;
  isOverlay?: boolean;
  onClose?: () => void;
}

const QUICK_REACTIONS = ["🔥", "👏", "⚽", "😱", "❤️"];
const MAX_NAME_LENGTH = 28;

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeDisplayName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  [...current, ...incoming].forEach((message) => {
    byId.set(message.id, message);
  });

  return [...byId.values()].sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
  );
}

function getActiveMentionQuery(value: string) {
  const match = value.match(/(^|\s)@([A-Za-z0-9_ -]{0,28})$/);
  return match ? match[2].toLowerCase() : null;
}

function renderMessageBody(body: string) {
  const parts = body.split(/(@[A-Za-z0-9_ -]{1,28})/g);

  return parts.map((part, index) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span key={`${part}-${index}`} className="font-black text-emerald-200">
          {part}
        </span>
      );
    }

    return part;
  });
}

export function LiveMatchChat({ playerId, roomTitle, isOverlay = false, onClose }: LiveMatchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [viewerName, setViewerName] = useState("Fan");
  const [nameInput, setNameInput] = useState("Fan");
  const [isSending, setIsSending] = useState(false);
  const [isSocketLive, setIsSocketLive] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const latestMessageTimeRef = useRef("");
  const lastReactionSentRef = useRef<number>(0);

  const [isFloatingEnabled, setIsFloatingEnabled] = useState(false);

  useEffect(() => {
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

  const toggleFloating = () => {
    const nextState = !isFloatingEnabled;
    setIsFloatingEnabled(nextState);
    localStorage.setItem("live_chat_float_enabled", nextState ? "true" : "false");
    window.dispatchEvent(
      new CustomEvent("live-chat-float-toggled", { detail: { enabled: nextState } })
    );
  };

  const knownUsers = useMemo(() => {
    const users = new Set<string>();
    messages.forEach((message) => {
      const author = normalizeDisplayName(message.author);
      if (author && author.toLowerCase() !== viewerName.toLowerCase()) {
        users.add(author);
      }
    });

    return [...users].sort((first, second) => first.localeCompare(second)).slice(0, 20);
  }, [messages, viewerName]);

  const mentionQuery = getActiveMentionQuery(messageText);
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }

    return knownUsers
      .filter((user) => user.toLowerCase().includes(mentionQuery))
      .slice(0, 5);
  }, [knownUsers, mentionQuery]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | undefined;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(
        `${protocol}//${window.location.host}/api/chat/socket?playerId=${encodeURIComponent(playerId)}`
      );

      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (cancelled) {
          socket.close();
          return;
        }
        console.log(`[WebSocket] Connected successfully to chat room: ${playerId}`);
        setIsSocketLive(true);
        setError("");
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            messages?: ChatMessage[];
            message?: ChatMessage;
            error?: string;
          };

          if (payload.type === "history" && Array.isArray(payload.messages)) {
            setMessages((current) => mergeMessages(current, payload.messages ?? []));
          }

          if (payload.type === "message" && payload.message) {
            setMessages((current) => mergeMessages(current, [payload.message as ChatMessage]));
            if (payload.message.kind === "reaction") {
              console.log(`[WebSocket] Received reaction message: ${payload.message.body} (id: ${payload.message.id})`);
              window.dispatchEvent(
                new CustomEvent("live-chat-reaction", {
                  detail: { id: payload.message.id, emoji: payload.message.body },
                })
              );
            } else {
              window.dispatchEvent(
                new CustomEvent("live-chat-comment", {
                  detail: { id: payload.message.id, author: payload.message.author, body: payload.message.body },
                })
              );
            }
          }

          if (payload.type === "error" && payload.error) {
            setError(payload.error);
          }
        } catch {
          setError("Chat received an invalid update.");
        }
      });

      socket.addEventListener("close", () => {
        if (cancelled) {
          return;
        }
        console.log(`[WebSocket] Disconnected from chat room: ${playerId}, retrying connect...`);
        setIsSocketLive(false);
        setError("");
        reconnectTimer = window.setTimeout(connect, 1500);
      });

      socket.addEventListener("error", () => {
        setIsSocketLive(false);
        setError("");
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      socketRef.current?.close();
    };
  }, [playerId]);

  useEffect(() => {
    latestMessageTimeRef.current = messages.at(-1)?.createdAt ?? "";
  }, [messages]);

  useEffect(() => {
    if (isSocketLive) {
      return;
    }

    let cancelled = false;

    async function fetchMessages() {
      try {
        const after = latestMessageTimeRef.current;
        const params = after ? `?after=${encodeURIComponent(after)}` : "";
        const response = await fetch(`/api/chat/${encodeURIComponent(playerId)}${params}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load chat.");
        }

        const data = (await response.json()) as { messages?: ChatMessage[] };
        if (!cancelled && Array.isArray(data.messages)) {
          const incoming = data.messages ?? [];
          setMessages((current) => {
            const currentIds = new Set(current.map((m) => m.id));
            incoming.forEach((msg) => {
              if (!currentIds.has(msg.id)) {
                if (msg.kind === "reaction") {
                  console.log(`[Polling] Received new reaction message: ${msg.body} (id: ${msg.id})`);
                  window.dispatchEvent(
                    new CustomEvent("live-chat-reaction", {
                      detail: { id: msg.id, emoji: msg.body },
                    })
                  );
                } else {
                  window.dispatchEvent(
                    new CustomEvent("live-chat-comment", {
                      detail: { id: msg.id, author: msg.author, body: msg.body },
                    })
                  );
                }
              }
            });
            return mergeMessages(current, incoming);
          });
        }
      } catch {
        if (!cancelled) {
          setError("Chat sync is retrying...");
        }
      }
    }

    fetchMessages();
    const interval = window.setInterval(fetchMessages, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isSocketLive, playerId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  async function sendMessage(body: string, kind: ChatMessage["kind"] = "message") {
    const trimmedBody = body.trim();
    if (!trimmedBody || isSending) {
      return;
    }

    if (kind === "reaction") {
      const now = Date.now();
      if (now - lastReactionSentRef.current < 450) {
        console.log(`[Reaction] Sender throttled reaction: ${trimmedBody}`);
        return;
      }
      lastReactionSentRef.current = now;
    }

    setIsSending(true);
    setError("");

    try {
      const socketPayload = JSON.stringify({
        type: "message",
        author: viewerName,
        body: trimmedBody,
        kind,
      });

      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(socketPayload);
        setMessageText("");
        return;
      }

      const response = await fetch(`/api/chat/${encodeURIComponent(playerId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: viewerName,
          body: trimmedBody,
          kind,
        }),
      });

      const data = (await response.json()) as { message?: ChatMessage; error?: string };
      if (!response.ok || !data.message) {
        throw new Error(data.error || "Failed to send message.");
      }

      setMessages((current) => mergeMessages(current, [data.message as ChatMessage]));
      if (data.message.kind === "reaction") {
        console.log(`[POST Fallback] Sent and received reaction message: ${data.message.body} (id: ${data.message.id})`);
        window.dispatchEvent(
          new CustomEvent("live-chat-reaction", {
            detail: { id: data.message.id, emoji: data.message.body },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("live-chat-comment", {
            detail: { id: data.message.id, author: data.message.author, body: data.message.body },
          })
        );
      }
      setMessageText("");
    } catch {
      setError("Message not sent. Try again.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(messageText);
  }

  function handleNameChange(value: string) {
    const nextName = value.slice(0, MAX_NAME_LENGTH);
    setNameInput(nextName);

    const normalizedName = normalizeDisplayName(nextName);
    if (normalizedName) {
      setViewerName(normalizedName);
    }
  }

  function insertMention(user: string) {
    setMessageText((current) => {
      const nextMention = `@${user} `;

      if (getActiveMentionQuery(current) === null) {
        return `${current}${current && !current.endsWith(" ") ? " " : ""}${nextMention}`;
      }

      return current.replace(/(^|\s)@[A-Za-z0-9_ -]{0,28}$/, (match, prefix: string) => {
        return `${prefix}${nextMention}`;
      });
    });
  }

  return (
    <aside
      className={
        isOverlay
          ? "flex h-full w-full flex-col overflow-hidden bg-[#090a0f]/90 backdrop-blur-md border-l border-white/10 shadow-2xl select-none"
          : "flex h-[28rem] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115]/95 shadow-2xl sm:h-[32rem] lg:sticky lg:top-6 lg:h-[min(72vh,38rem)] lg:min-h-[30rem]"
      }
    >
      <div className={`flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <MessageCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex items-baseline gap-1.5">
            <h2 className="truncate font-black text-xs uppercase tracking-wider text-white">
              Chat
            </h2>
            {!isOverlay && (
              <span className="truncate text-[10px] font-bold text-slate-500 max-w-[120px]">
                ({roomTitle})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
              isSocketLive
                ? "border-red-400/30 bg-red-500/10 text-red-200"
                : "border-amber-300/20 bg-amber-300/5 text-amber-200"
            }`}
          >
            <span
              className={`h-1 w-1 rounded-full ${
                isSocketLive ? "bg-red-400" : "bg-amber-300"
              }`}
            />
            {isSocketLive ? "Live" : "Sync"}
          </span>
          {isOverlay && onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition text-slate-400 hover:text-white cursor-pointer"
              title="Close chat"
              aria-label="Close chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {!isOverlay && (
        <div className="border-b border-white/5 bg-white/[0.02] px-3 py-1 text-[10px] font-medium text-slate-500 select-none">
          Keep it friendly. Spam and abusive comments may be removed.
        </div>
      )}

      <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto ${isOverlay ? "space-y-2 px-3 py-2" : "space-y-3 px-4 py-4"}`}>
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Smile className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-bold text-slate-300">Start the match conversation</p>
              <p className="mt-1 text-xs text-slate-500">Send a cheer or react to the live action.</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`border ${
                isOverlay ? "rounded-xl px-2.5 py-1.5" : "rounded-2xl px-3 py-2"
              } ${
                message.kind === "reaction"
                  ? "border-emerald-300/20 bg-emerald-300/[0.08]"
                  : "border-white/8 bg-white/[0.055]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`min-w-0 truncate font-black text-emerald-100 ${isOverlay ? "text-[11px]" : "text-xs"}`}>
                  {message.author}
                </p>
                <time className={`shrink-0 font-semibold text-slate-500 ${isOverlay ? "text-[9px]" : "text-[10px]"}`}>
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>
              <p
                className={`break-words ${
                  message.kind === "reaction"
                    ? isOverlay ? "text-xl leading-6 mt-0.5" : "text-2xl leading-8 mt-1"
                    : isOverlay ? "text-xs leading-4 mt-0.5 text-slate-200" : "text-sm leading-5 mt-1 text-slate-100"
                }`}
              >
                {renderMessageBody(message.body)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className={`border-t border-white/10 ${isOverlay ? "p-2 bg-black/40" : "p-3"}`}>
        <div className={`flex items-center gap-2 overflow-x-auto ${isOverlay ? "mb-2 scrollbar-none" : "mb-3"}`}>
          {QUICK_REACTIONS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              onClick={() => sendMessage(reaction, "reaction")}
              className={`grid shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] transition hover:border-emerald-200/40 hover:bg-emerald-300/10 cursor-pointer ${
                isOverlay ? "h-7 w-7 text-sm" : "h-9 w-9 text-lg"
              }`}
              title={`Send ${reaction}`}
              aria-label={`Send ${reaction}`}
            >
              {reaction}
            </button>
          ))}
        </div>

        <div className={`flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 ${isOverlay ? "mb-2 px-2.5 py-1" : "mb-3 px-3 py-2"}`}>
          <UserRound className={`shrink-0 text-slate-400 ${isOverlay ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
          <input
            value={nameInput}
            onChange={(event) => handleNameChange(event.target.value)}
            onBlur={() => {
              if (!normalizeDisplayName(nameInput)) {
                handleNameChange(viewerName);
              }
            }}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Your name"
            className="min-w-0 flex-1 bg-transparent text-xs font-black text-white outline-none placeholder:text-slate-500"
            aria-label="Your chat name"
          />
        </div>

        {mentionSuggestions.length > 0 ? (
          <div className="mb-2 flex items-center gap-2 overflow-x-auto">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-400">
              <AtSign className="h-3.5 w-3.5" />
            </span>
            {mentionSuggestions.map((user) => (
              <button
                key={user}
                type="button"
                onClick={() => insertMention(user)}
                className="shrink-0 rounded-full border border-emerald-200/20 bg-emerald-300/[0.08] px-2.5 py-1 text-[11px] font-black text-emerald-100 transition hover:border-emerald-200/45 hover:bg-emerald-300/15 cursor-pointer"
              >
                @{user}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            maxLength={280}
            placeholder={`Message as ${viewerName}. Use @ to tag`}
            className={`min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 outline-none transition placeholder:text-slate-500 focus:border-emerald-200/45 ${
              isOverlay ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-3 text-sm"
            }`}
          />
          <button
            type="submit"
            disabled={!messageText.trim() || isSending}
            className={`grid shrink-0 place-items-center rounded-xl bg-emerald-300 text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25 cursor-pointer ${
              isOverlay ? "h-8 w-8" : "h-11 w-11"
            }`}
            title="Send message"
            aria-label="Send message"
          >
            <Send className={isOverlay ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} />
          </button>
        </form>

        {error ? <p className="mt-2 text-xs font-semibold text-amber-200">{error}</p> : null}
      </div>
    </aside>
  );
}

