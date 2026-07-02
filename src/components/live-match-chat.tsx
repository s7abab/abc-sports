"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, MessageCircle, Send, Smile, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import type { ChatMessage } from "@/lib/chat-storage";
import { createClient } from "@/utils/supabase/client";

interface LiveMatchChatProps {
  playerId: string;
  roomTitle: string;
  isOverlay?: boolean;
  onClose?: () => void;
}

const QUICK_REACTIONS = ["🔥", "👏", "⚽", "😱", "❤️"];
const MAX_NAME_LENGTH = 28;
const MAX_RENDERED_MESSAGES = 160;
const CHAT_BROADCAST_EVENT = "chat-message";
const LOCAL_ECHO_TTL_MS = 8_000;

type ChatSocketMessage = ChatMessage & {
  clientId?: string;
};

type LocalChatMessage = ChatMessage & {
  clientId?: string;
  deliveryStatus?: "sending" | "sent" | "failed";
};

type ChatMessageRow = {
  id: string;
  player_id: string;
  author: string;
  body: string;
  kind: string;
  created_at: string;
};

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

function mergeMessages(current: LocalChatMessage[], incoming: LocalChatMessage[]) {
  if (incoming.length === 0) {
    return current;
  }

  const seenIds = new Set(current.map((message) => message.id));
  let next = current;
  let needsSort = false;
  let latestTime = current.at(-1)?.createdAt ?? "";

  incoming.forEach((message) => {
    if (seenIds.has(message.id)) {
      return;
    }

    seenIds.add(message.id);
    next = next === current ? [...current, message] : [...next, message];

    if (latestTime && message.createdAt < latestTime) {
      needsSort = true;
    }
    if (!latestTime || message.createdAt > latestTime) {
      latestTime = message.createdAt;
    }
  });

  if (next === current) {
    return current;
  }

  if (needsSort) {
    next.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }

  return next.slice(-MAX_RENDERED_MESSAGES);
}

function replaceOptimisticMessage(
  current: LocalChatMessage[],
  clientId: string | undefined,
  message: LocalChatMessage
) {
  if (!clientId) {
    return mergeMessages(current, [message]);
  }

  const index = current.findIndex((item) => item.clientId === clientId);
  if (index === -1) {
    return mergeMessages(current, [message]);
  }

  const next = [...current];
  next[index] = { ...message, clientId, deliveryStatus: "sent" };
  return mergeMessages([], next);
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

function emitChatEvent(message: ChatMessage) {
  if (message.kind === "reaction") {
    window.dispatchEvent(
      new CustomEvent("live-chat-reaction", {
        detail: { id: message.id, emoji: message.body },
      })
    );
    return;
  }

  window.dispatchEvent(
    new CustomEvent("live-chat-comment", {
      detail: { id: message.id, author: message.author, body: message.body },
    })
  );
}

function mapChatRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    playerId: row.player_id,
    author: row.author,
    body: row.body,
    kind: row.kind === "reaction" ? "reaction" : "message",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function getMessageSignature(message: Pick<ChatMessage, "author" | "body" | "kind" | "playerId">) {
  return [
    message.playerId,
    normalizeDisplayName(message.author).toLowerCase(),
    message.kind,
    message.body.trim().toLowerCase(),
  ].join("|");
}

export function LiveMatchChat({ playerId, roomTitle, isOverlay = false, onClose }: LiveMatchChatProps) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [hasSetName, setHasSetName] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const savedName = localStorage.getItem("chat_viewer_name");
      if (savedName) {
        const normalized = normalizeDisplayName(savedName);
        if (normalized) {
          setViewerName(normalized);
          setNameInput(normalized);
          setHasSetName(true);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const [isSending, setIsSending] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [isSocketLive, setIsSocketLive] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const isReactionThrottledRef = useRef(false);
  const localMessageCounterRef = useRef(0);
  const localEchoIdsRef = useRef(new Set<string>());
  const localEchoSignaturesRef = useRef(new Set<string>());
  const messageIdsRef = useRef(new Set<string>());
  const latestMessageTimeRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isRealtimeSubscribedRef = useRef(false);

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
    messageIdsRef.current = new Set();
    latestMessageTimeRef.current = null;

    function isLocalEcho(message: ChatMessage) {
      const signature = getMessageSignature(message);
      if (!localEchoSignaturesRef.current.has(signature)) {
        return false;
      }

      localEchoSignaturesRef.current.delete(signature);
      return true;
    }

    function acceptIncoming(message: ChatMessage, options: { emit?: boolean } = {}) {
      const isKnown = messageIdsRef.current.has(message.id);
      const shouldSuppressEcho = !isKnown && isLocalEcho(message);
      messageIdsRef.current.add(message.id);
      latestMessageTimeRef.current =
        !latestMessageTimeRef.current || message.createdAt > latestMessageTimeRef.current
          ? message.createdAt
          : latestMessageTimeRef.current;
      setMessages((current) => mergeMessages(current, [{ ...message, deliveryStatus: "sent" }]));
      if (!isKnown && options.emit && !shouldSuppressEcho) {
        emitChatEvent(message);
      }
    }

    async function fetchSnapshot(after?: string | null) {
      try {
        const url = new URL(`/api/chat/${encodeURIComponent(playerId)}`, window.location.origin);
        if (after) {
          url.searchParams.set("after", after);
        }

        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Failed to load chat.");
        }

        const data = (await response.json()) as { messages?: ChatMessage[] };
        if (!cancelled && Array.isArray(data.messages)) {
          data.messages.forEach((message) => acceptIncoming(message, { emit: Boolean(after) }));
        }
      } catch {
        if (!cancelled) {
          setError("Chat history is unavailable.");
        }
      }
    }

    void fetchSnapshot();

    const channelName = `live-chat:${playerId}`;
    const supabase = createClient();
    const realtimeTopic = `realtime:${channelName}`;
    supabase
      .getChannels()
      .filter((existingChannel) => existingChannel.topic === realtimeTopic)
      .forEach((existingChannel) => {
        void supabase.removeChannel(existingChannel);
      });

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: CHAT_BROADCAST_EVENT }, (payload) => {
        const message = (payload.payload as { message?: ChatMessage }).message;
        if (!message) {
          return;
        }

        acceptIncoming(message, { emit: true });
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          acceptIncoming(mapChatRow(payload.new as ChatMessageRow), { emit: true });
        }
      )
      .subscribe((status) => {
        if (cancelled) {
          return;
        }

        const isSubscribed = status === "SUBSCRIBED";
        isRealtimeSubscribedRef.current = isSubscribed;
        setIsSocketLive(isSubscribed);
        if (isSubscribed) {
          setError("");
        }
      });
    channelRef.current = channel;

    return () => {
      cancelled = true;
      isRealtimeSubscribedRef.current = false;
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [playerId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isNearBottomRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 96;
  }

  async function sendMessage(body: string, kind: ChatMessage["kind"] = "message") {
    const trimmedBody = body.trim();
    if (!trimmedBody || (isSending && kind !== "reaction")) {
      return;
    }

    localMessageCounterRef.current += 1;
    const clientId = `${kind}-${localMessageCounterRef.current}`;
    const optimisticMessage: LocalChatMessage = {
      id: `pending-${clientId}`,
      playerId,
      author: viewerName,
      body: trimmedBody,
      kind,
      createdAt: new Date().toISOString(),
      clientId,
      deliveryStatus: "sending",
    };
    const localEchoSignature = getMessageSignature(optimisticMessage);
    localEchoSignaturesRef.current.add(localEchoSignature);
    window.setTimeout(() => {
      localEchoSignaturesRef.current.delete(localEchoSignature);
    }, LOCAL_ECHO_TTL_MS);

    if (kind === "reaction") {
      if (isReactionThrottledRef.current) {
        console.log(`[Reaction] Sender throttled reaction: ${trimmedBody}`);
        return;
      }
      isReactionThrottledRef.current = true;
      window.setTimeout(() => {
        isReactionThrottledRef.current = false;
      }, 450);
      localEchoIdsRef.current.add(clientId);
      window.setTimeout(() => localEchoIdsRef.current.delete(clientId), 5000);
      window.dispatchEvent(
        new CustomEvent("live-chat-reaction", {
          detail: { id: clientId, emoji: trimmedBody },
        })
      );
    }

    isNearBottomRef.current = true;
    setMessages((current) => mergeMessages(current, [optimisticMessage]));
    if (kind !== "reaction") {
      emitChatEvent(optimisticMessage);
    }

    if (kind === "message") {
      setIsSending(true);
      setMessageText("");
    }
    setError("");

    try {
      const response = await fetch(`/api/chat/${encodeURIComponent(playerId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: viewerName,
          body: trimmedBody,
          kind,
          clientId,
        }),
      });

      const data = (await response.json()) as { message?: ChatSocketMessage; error?: string };
      if (!response.ok || !data.message) {
        throw new Error(data.error || "Failed to send message.");
      }

      messageIdsRef.current.add(data.message.id);
      latestMessageTimeRef.current =
        !latestMessageTimeRef.current || data.message.createdAt > latestMessageTimeRef.current
          ? data.message.createdAt
          : latestMessageTimeRef.current;
      setMessages((current) =>
        replaceOptimisticMessage(current, data.message?.clientId, data.message as LocalChatMessage)
      );
      if (data.message.clientId && localEchoIdsRef.current.has(data.message.clientId)) {
        localEchoIdsRef.current.delete(data.message.clientId);
      }
      const channel = channelRef.current;
      if (channel) {
        const payload = { message: data.message };
        if (isRealtimeSubscribedRef.current) {
          void channel.send({
            type: "broadcast",
            event: CHAT_BROADCAST_EVENT,
            payload,
          });
        } else {
          void channel.httpSend(CHAT_BROADCAST_EVENT, payload);
        }
      }
    } catch {
      setError("Message not sent. Try again.");
      setMessages((current) =>
        current.map((message) =>
          message.clientId === clientId ? { ...message, deliveryStatus: "failed" } : message
        )
      );
    } finally {
      if (kind === "message") {
        setIsSending(false);
      }
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
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            <h2 className="truncate font-black text-xs uppercase tracking-wider text-white" title={roomTitle}>
              Chat
            </h2>
            {hasSetName && (
              <div className="flex items-center gap-1 text-[10px] font-black shrink-0 select-none ml-1.5">
                <span className="text-emerald-400">{viewerName}</span>
                <button
                  type="button"
                  onClick={() => setHasSetName(false)}
                  className="text-slate-500 hover:text-emerald-300 transition cursor-pointer underline font-semibold ml-0.5 text-[9px]"
                  title="Change your chat display name"
                >
                  (Edit)
                </button>
              </div>
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

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`min-h-0 flex-1 overflow-y-auto ${isOverlay ? "space-y-2 px-3 py-2" : "space-y-3 px-4 py-4"}`}
      >
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
                message.deliveryStatus === "failed"
                  ? "border-rose-300/25 bg-rose-400/[0.08]"
                  :
                message.kind === "reaction"
                  ? "border-emerald-300/20 bg-emerald-300/[0.08]"
                  : "border-white/8 bg-white/[0.055]"
              } transition will-change-transform animate-[chatMessageIn_180ms_ease-out]`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`min-w-0 truncate font-black text-emerald-100 ${isOverlay ? "text-[11px]" : "text-xs"}`}>
                  {message.author}
                </p>
                <div className={`flex shrink-0 items-center gap-1 font-semibold text-slate-500 ${isOverlay ? "text-[9px]" : "text-[10px]"}`}>
                  {message.deliveryStatus === "sending" ? <span className="text-emerald-200/70">Sending</span> : null}
                  {message.deliveryStatus === "failed" ? <span className="text-rose-200">Failed</span> : null}
                  <time>{formatMessageTime(message.createdAt)}</time>
                </div>
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
              onClick={() => {
                if (!hasSetName) {
                  nameInputRef.current?.focus();
                  setError("Please enter your name to react.");
                  return;
                }
                sendMessage(reaction, "reaction");
              }}
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

        {!hasSetName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = nameInput.trim();
              const normalized = normalizeDisplayName(trimmed);
              if (normalized) {
                setViewerName(normalized);
                localStorage.setItem("chat_viewer_name", normalized);
                setHasSetName(true);
                setError("");
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Enter name to start chatting..."
              className={`min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 outline-none transition placeholder:text-slate-500 focus:border-emerald-200/45 ${
                isOverlay ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-3 text-sm"
              }`}
              required
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className={`grid shrink-0 place-items-center rounded-xl bg-emerald-300 text-emerald-950 font-bold transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25 cursor-pointer ${
                isOverlay ? "h-8 px-3 text-xs" : "h-11 px-4 text-xs uppercase tracking-wider"
              }`}
            >
              Join
            </button>
          </form>
        ) : (
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
        )}

        {error ? <p className="mt-2 text-xs font-semibold text-amber-200">{error}</p> : null}
      </div>
    </aside>
  );
}
