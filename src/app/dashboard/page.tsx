"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/video-player";
import type { MatchConfig } from "@/lib/match-storage";
import type { BroadcastMessage } from "@/lib/broadcast-storage";
import {
  deriveRuntimeMatchStatus,
  formatMatchDate,
  getLocalDateKey,
  type MatchStatus,
} from "@/lib/match-utils";
import { Tv, Sparkles, Loader2, Copy, Check, Settings, Save, ExternalLink, X, Plus, CalendarPlus, Pencil, Trash2, RotateCcw, Megaphone, Send, Image as ImageIcon } from "lucide-react";

interface PlayerServer {
  name: string;
  url: string;
  isIframe?: boolean;
}

type PlayerServers = Record<string, PlayerServer>;

interface PlayerConfig {
  id: string;
  name: string;
  primaryServer: string;
  servers: PlayerServers;
}

interface StreamHealthAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  playerId: string;
  serverId?: string;
  createdAt: string;
}

const DEFAULT_SERVER_SLOT_COUNT = 4;

function createEmptyServer(): PlayerServer {
  return { name: "", url: "", isIframe: false };
}

function sortServerIds(servers: PlayerServers) {
  return Object.keys(servers).sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function createEditableServers(servers?: PlayerServers): PlayerServers {
  const editable: PlayerServers = {};

  for (let index = 1; index <= DEFAULT_SERVER_SLOT_COUNT; index += 1) {
    editable[String(index)] = createEmptyServer();
  }

  Object.entries(servers ?? {}).forEach(([slot, server]) => {
    editable[slot] = {
      name: server?.name ?? "",
      url: server?.url ?? "",
      isIframe: server?.isIframe === true,
    };
  });

  return editable;
}

function cleanServersForSave(servers: PlayerServers): PlayerServers {
  const cleaned = Object.entries(servers).reduce<PlayerServers>((acc, [slot, server]) => {
    const name = server.name.trim();
    const url = server.url.trim();
    if (!name && !url) return acc;

    acc[slot] = {
      name,
      url,
      isIframe: server.isIframe === true,
    };
    return acc;
  }, {});

  return Object.keys(cleaned).length > 0 ? cleaned : createEditableServers();
}

function getNextServerSlot(servers: PlayerServers) {
  const numericSlots = Object.keys(servers)
    .map((slot) => Number(slot))
    .filter((slot) => Number.isFinite(slot));

  return String(numericSlots.length > 0 ? Math.max(...numericSlots) + 1 : Object.keys(servers).length + 1);
}

function getPrimaryServerId(servers: PlayerServers, preferred?: string) {
  if (preferred && servers[preferred]?.url) return preferred;
  return sortServerIds(servers).find((slot) => servers[slot]?.url) ?? sortServerIds(servers)[0] ?? "1";
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"matches" | "players" | "settings">("matches");
  const [players, setPlayers] = useState<PlayerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [matches, setMatches] = useState<MatchConfig[]>([]);
  const [isMatchesLoading, setIsMatchesLoading] = useState(true);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastDescription, setBroadcastDescription] = useState("");
  const [broadcastActionLabel, setBroadcastActionLabel] = useState("Open");
  const [broadcastCancelLabel, setBroadcastCancelLabel] = useState("Close");
  const [broadcastActionUrl, setBroadcastActionUrl] = useState("");
  const [broadcastImageUrls, setBroadcastImageUrls] = useState(["", "", ""]);
  const [broadcastIsActive, setBroadcastIsActive] = useState(false);
  const [isSavingBroadcast, setIsSavingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [activeMatchFilter, setActiveMatchFilter] = useState<MatchStatus>("today");
  const [editingMatch, setEditingMatch] = useState<MatchConfig | null>(null);
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [matchForm, setMatchForm] = useState({
    competition: "FIFA World Cup 2026",
    date: getLocalDateKey(),
    time: "",
    home: "",
    away: "",
    playerId: "1",
    homeLogoUrl: "",
    awayLogoUrl: "",
    status: "pending",
  });

  // Single Player Configuration Modal State
  const [editingPlayer, setEditingPlayer] = useState<PlayerConfig | null>(null);
  const [inputUrls, setInputUrls] = useState<PlayerServers>(createEditableServers());
  const [editingPrimaryServer, setEditingPrimaryServer] = useState<string>("1");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Bulk Configuration Modal State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [activeBulkTab, setActiveBulkTab] = useState<string>("1");
  const [bulkInputUrls, setBulkInputUrls] = useState<Record<string, PlayerServers>>({});
  const [bulkPrimaryServers, setBulkPrimaryServers] = useState<{ [key: string]: string }>({});

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamHealthSummary, setStreamHealthSummary] = useState("No stream health events have been reported yet.");
  const [streamHealthAlerts, setStreamHealthAlerts] = useState<StreamHealthAlert[]>([]);
  const [isHealthLoading, setIsHealthLoading] = useState(false);

  const getRelativeDateKey = (day: "today" | "tomorrow") => {
    const now = new Date();
    if (day === "today") {
      return getLocalDateKey(now);
    }

    return getLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  };

  const splitMatchDateTime = (value: string) => {
    const [datePart = "", timePart = ""] = value.split("T");
    return {
      date: datePart,
      time: timePart,
    };
  };

  const composeMatchDateTime = (date: string, time: string) => {
    const trimmedTime = time.trim();
    return trimmedTime ? `${date}T${trimmedTime}` : date;
  };

  // Fetch current configurations
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const response = await fetch("/api/players");
        if (response.ok) {
          const data = await response.json();
          setPlayers(data);
        }
      } catch (err) {
        console.error("Error loading players:", err);
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchMatches() {
      try {
        const response = await fetch("/api/matches");
        if (response.ok) {
          const data = await response.json();
          setMatches(data);
        }
      } catch (err) {
        console.error("Error loading matches:", err);
      } finally {
        setIsMatchesLoading(false);
      }
    }

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

    async function fetchBroadcast() {
      try {
        const response = await fetch("/api/broadcast", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as BroadcastMessage | null;
        if (!data) {
          setBroadcastIsActive(false);
          return;
        }

        setBroadcastTitle(data.title || "");
        setBroadcastDescription(data.description || "");
        setBroadcastActionLabel(data.actionLabel || "Open");
        setBroadcastCancelLabel(data.cancelLabel || "Close");
        setBroadcastActionUrl(data.actionUrl || "");
        setBroadcastImageUrls([data.imageUrls?.[0] || "", data.imageUrls?.[1] || "", data.imageUrls?.[2] || ""]);
        setBroadcastIsActive(Boolean(data.isActive));
      } catch (err) {
        console.error("Error loading broadcast message:", err);
      }
    }

    fetchPlayers();
    fetchMatches();
    fetchSettings();
    fetchBroadcast();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchStreamHealth() {
      try {
        setIsHealthLoading(true);
        const response = await fetch("/api/stream-health", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          summary?: string;
          alerts?: StreamHealthAlert[];
        };

        if (!cancelled) {
          setStreamHealthSummary(data.summary || "No stream health events have been reported yet.");
          setStreamHealthAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        }
      } finally {
        if (!cancelled) {
          setIsHealthLoading(false);
        }
      }
    }

    fetchStreamHealth();
    const interval = window.setInterval(fetchStreamHealth, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsError("");
    setSettingsSuccess(false);

    if (whatsappUrl) {
      try {
        const parsed = new URL(whatsappUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          setSettingsError("Please enter a valid URL starting with http/https.");
          setIsSavingSettings(false);
          return;
        }
      } catch {
        setSettingsError("Please enter a valid URL.");
        setIsSavingSettings(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappUrl }),
      });

      if (response.ok) {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
      } else {
        setSettingsError("Failed to save settings.");
      }
    } catch (err) {
      setSettingsError("An error occurred while saving settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateBroadcastImageUrl = (index: number, value: string) => {
    setBroadcastImageUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const validateBroadcastUrl = (value: string) => {
    if (!value.trim()) return true;
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastError("");
    setBroadcastSuccess(false);
    setIsSavingBroadcast(true);

    const nextTitle = broadcastTitle.trim();
    const nextDescription = broadcastDescription.trim();
    const nextActionLabel = broadcastActionLabel.trim() || "Open";
    const nextCancelLabel = broadcastCancelLabel.trim() || "Close";
    const nextActionUrl = broadcastActionUrl.trim();
    const nextImageUrls = broadcastImageUrls.map((url) => url.trim()).filter(Boolean);

    if (!validateBroadcastUrl(nextActionUrl)) {
      setBroadcastError("Please enter a valid action link starting with http/https.");
      setIsSavingBroadcast(false);
      return;
    }

    if (nextImageUrls.some((url) => !validateBroadcastUrl(url))) {
      setBroadcastError("Please enter valid image URLs starting with http/https.");
      setIsSavingBroadcast(false);
      return;
    }

    if (broadcastIsActive && !nextTitle && !nextDescription && nextImageUrls.length === 0 && !nextActionUrl) {
      setBroadcastError("Add a title, description, image, or action link before broadcasting.");
      setIsSavingBroadcast(false);
      return;
    }

    try {
      const response = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nextTitle,
          description: nextDescription,
          actionLabel: nextActionLabel,
          cancelLabel: nextCancelLabel,
          actionUrl: nextActionUrl,
          imageUrls: nextImageUrls,
          isActive: broadcastIsActive,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { broadcast?: BroadcastMessage };
        if (data.broadcast) {
          setBroadcastTitle(data.broadcast.title || "");
          setBroadcastDescription(data.broadcast.description || "");
          setBroadcastActionLabel(data.broadcast.actionLabel || "Open");
          setBroadcastCancelLabel(data.broadcast.cancelLabel || "Close");
          setBroadcastActionUrl(data.broadcast.actionUrl || "");
          setBroadcastImageUrls([
            data.broadcast.imageUrls?.[0] || "",
            data.broadcast.imageUrls?.[1] || "",
            data.broadcast.imageUrls?.[2] || "",
          ]);
          setBroadcastIsActive(Boolean(data.broadcast.isActive));
        }
        setBroadcastSuccess(true);
        setTimeout(() => setBroadcastSuccess(false), 3000);
      } else {
        const data = await response.json();
        setBroadcastError(data.error || "Failed to save broadcast message.");
      }
    } catch (err) {
      setBroadcastError("An error occurred while saving the broadcast message.");
    } finally {
      setIsSavingBroadcast(false);
    }
  };

  const handleDisableBroadcast = async () => {
    setBroadcastError("");
    setBroadcastSuccess(false);
    setIsSavingBroadcast(true);

    try {
      const response = await fetch("/api/broadcast", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setBroadcastError(data.error || "Failed to disable broadcast message.");
        return;
      }

      setBroadcastIsActive(false);
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 3000);
    } catch (err) {
      setBroadcastError("An error occurred while disabling the broadcast message.");
    } finally {
      setIsSavingBroadcast(false);
    }
  };

  const handleCopyLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering details card navigation
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/player/${id}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
      });
  };

  const handleOpenSingleEdit = (player: PlayerConfig, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering details card navigation
    setEditingPlayer(player);
    const editableServers = createEditableServers(player.servers);
    setInputUrls(editableServers);
    setEditingPrimaryServer(getPrimaryServerId(editableServers, player.primaryServer));
    setSaveError("");
  };

  const handleOpenBulkEdit = () => {
    const urls: Record<string, PlayerServers> = {};
    const primaryServers: { [key: string]: string } = {};

    players.forEach((p) => {
      urls[p.id] = createEditableServers(p.servers);
      primaryServers[p.id] = getPrimaryServerId(urls[p.id], p.primaryServer);
    });
    setBulkInputUrls(urls);
    setBulkPrimaryServers(primaryServers);
    setSaveError("");
    if (players.length > 0) {
      setActiveBulkTab(players[0].id);
    }
    setIsBulkEditOpen(true);
  };

  const handleInlineUrlChange = (slot: string, val: string) => {
    setInputUrls((prev) => ({
      ...prev,
      [slot]: {
        ...(prev[slot] ?? createEmptyServer()),
        url: val,
      },
    }));
  };

  const handleInlineNameChange = (slot: string, val: string) => {
    setInputUrls((prev) => ({
      ...prev,
      [slot]: {
        ...(prev[slot] ?? createEmptyServer()),
        name: val,
      },
    }));
  };

  const handleInlineIframeToggle = (slot: string) => {
    setInputUrls((prev) => ({
      ...prev,
      [slot]: {
        ...(prev[slot] ?? createEmptyServer()),
        isIframe: !(prev[slot]?.isIframe === true),
      },
    }));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setIsSaving(true);
    setSaveError("");

    // Simple URL validation
    const invalidUrl = Object.values(inputUrls).some((slot) => {
      if (!slot.url) return false;
      try {
        const parsed = new URL(slot.url);
        return !["http:", "https:"].includes(parsed.protocol);
      } catch {
        return true;
      }
    });

    if (invalidUrl) {
      setSaveError("Please enter valid stream URLs (starting with http/https).");
      setIsSaving(false);
      return;
    }

    try {
      const cleanedServers = cleanServersForSave(inputUrls);
      const updatedPlayers = players.map((p) =>
        p.id === editingPlayer.id
          ? {
              ...p,
              servers: cleanedServers,
              primaryServer: getPrimaryServerId(cleanedServers, editingPrimaryServer),
            }
          : p
      );

      const response = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPlayers),
      });

      if (response.ok) {
        setPlayers(updatedPlayers);
        setEditingPlayer(null);
      } else {
        const data = await response.json();
        setSaveError(data.error || "Failed to save configuration.");
      }
    } catch (err) {
      setSaveError("An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkUrlChange = (playerId: string, slot: string, val: string) => {
    setBulkInputUrls((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [slot]: {
            ...(prev[playerId]?.[slot] ?? createEmptyServer()),
          url: val,
        },
      },
    }));
  };

  const handleBulkNameChange = (playerId: string, slot: string, val: string) => {
    setBulkInputUrls((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [slot]: {
            ...(prev[playerId]?.[slot] ?? createEmptyServer()),
          name: val,
        },
      },
    }));
  };

  const handleBulkIframeToggle = (playerId: string, slot: string) => {
    setBulkInputUrls((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [slot]: {
          ...(prev[playerId]?.[slot] ?? createEmptyServer()),
          isIframe: !(prev[playerId]?.[slot]?.isIframe === true),
        },
      },
    }));
  };

  const handleBulkPrimaryServerChange = (playerId: string, slot: string) => {
    setBulkPrimaryServers((prev) => ({
      ...prev,
      [playerId]: slot,
    }));
  };

  const handleAddInlineServer = () => {
    setInputUrls((prev) => ({
      ...prev,
      [getNextServerSlot(prev)]: createEmptyServer(),
    }));
  };

  const handleRemoveInlineServer = (slot: string) => {
    setInputUrls((prev) => {
      const next = { ...prev };
      delete next[slot];
      return Object.keys(next).length > 0 ? next : createEditableServers();
    });

    if (editingPrimaryServer === slot) {
      const nextServers = { ...inputUrls };
      delete nextServers[slot];
      setEditingPrimaryServer(getPrimaryServerId(nextServers));
    }
  };

  const handleAddBulkServer = (playerId: string) => {
    setBulkInputUrls((prev) => {
      const current = prev[playerId] ?? createEditableServers();
      return {
        ...prev,
        [playerId]: {
          ...current,
          [getNextServerSlot(current)]: createEmptyServer(),
        },
      };
    });
  };

  const handleRemoveBulkServer = (playerId: string, slot: string) => {
    setBulkInputUrls((prev) => {
      const current = prev[playerId] ?? createEditableServers();
      const next = { ...current };
      delete next[slot];
      return {
        ...prev,
        [playerId]: Object.keys(next).length > 0 ? next : createEditableServers(),
      };
    });

    if (bulkPrimaryServers[playerId] === slot) {
      const current = bulkInputUrls[playerId] ?? createEditableServers();
      const next = { ...current };
      delete next[slot];
      handleBulkPrimaryServerChange(playerId, getPrimaryServerId(next));
    }
  };

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");

    // Validate all input URLs
    let hasInvalidUrl = false;
    Object.values(bulkInputUrls).forEach((slotMap) => {
      Object.values(slotMap).forEach((slot) => {
        if (!slot.url) return;
        try {
          const parsed = new URL(slot.url);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            hasInvalidUrl = true;
          }
        } catch {
          hasInvalidUrl = true;
        }
      });
    });

    if (hasInvalidUrl) {
      setSaveError("Please enter valid stream URLs (starting with http/https).");
      setIsSaving(false);
      return;
    }

    try {
      const updatedPlayers = players.map((p) => {
        const cleanedServers = cleanServersForSave(bulkInputUrls[p.id] || p.servers);
        return {
          ...p,
          servers: cleanedServers,
          primaryServer: getPrimaryServerId(cleanedServers, bulkPrimaryServers[p.id] || p.primaryServer),
        };
      });

      const response = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPlayers),
      });

      if (response.ok) {
        setPlayers(updatedPlayers);
        setIsBulkEditOpen(false);
      } else {
        const data = await response.json();
        setSaveError(data.error || "Failed to save configurations.");
      }
    } catch (err) {
      setSaveError("An error occurred while saving configurations.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleHotSwapPrimaryServer = async (playerId: string, slot: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering details card navigation
    const target = players.find((p) => p.id === playerId);
    if (!target || target.primaryServer === slot) return;

    try {
      const updatedPlayers = players.map((p) =>
        p.id === playerId ? { ...p, primaryServer: slot } : p
      );

      const response = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPlayers),
      });

      if (response.ok) {
        setPlayers(updatedPlayers);
      }
    } catch (err) {
      console.error("Error hot-swapping primary server:", err);
    }
  };

  const getActiveServer = (player: PlayerConfig): PlayerServer | null => {
    if (!player.servers) return null;
    const primary = player.primaryServer || "1";
    if (player.servers[primary]?.url) {
      return player.servers[primary];
    }

    const fallbackSlot = sortServerIds(player.servers).find((slot) => player.servers[slot]?.url);
    return fallbackSlot ? player.servers[fallbackSlot] : null;
  };

  const TeamLogoThumb = ({
    name,
    logoUrl,
  }: {
    name: string;
    logoUrl: string;
  }) =>
    logoUrl ? (
      <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
      </div>
    ) : (
      <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-[11px] font-bold uppercase text-slate-200">
        {name.slice(0, 2)}
      </div>
    );

  const handleOpenMatchEdit = (match: MatchConfig) => {
    setEditingMatch(match);
    setMatchError("");
    const { date, time } = splitMatchDateTime(match.date);
    setMatchForm({
      competition: match.competition,
      date: date || getRelativeDateKey("today"),
      time,
      home: match.home,
      away: match.away,
      playerId: match.playerId || "1",
      homeLogoUrl: match.homeLogoUrl || "",
      awayLogoUrl: match.awayLogoUrl || "",
      status: match.live ? "live" : (match.status === "completed" ? "completed" : "pending"),
    });
  };

  const handleStartNewMatch = () => {
    setEditingMatch(null);
    setMatchError("");
    setMatchForm({
      competition: "FIFA World Cup 2026",
      date: getRelativeDateKey("today"),
      time: "",
      home: "",
      away: "",
      playerId: players[0]?.id || "1",
      homeLogoUrl: "",
      awayLogoUrl: "",
      status: "pending",
    });
  };

  const handleDeleteMatch = async (match: MatchConfig) => {
    const confirmed = window.confirm(`Delete ${match.home} vs ${match.away}?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/matches/${match.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setMatchError(data.error || "Failed to delete match.");
        return;
      }

      setMatches((prev) => prev.filter((item) => item.id !== match.id));
      if (editingMatch?.id === match.id) {
        handleStartNewMatch();
      }
    } catch (err) {
      setMatchError("An error occurred while deleting the match.");
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError("");
    setIsSavingMatch(true);

    const date = composeMatchDateTime(matchForm.date, matchForm.time);

    const payload = {
      competition: matchForm.competition.trim(),
      date,
      home: matchForm.home.trim(),
      away: matchForm.away.trim(),
      playerId: matchForm.playerId || players[0]?.id || "1",
      homeLogoUrl: matchForm.homeLogoUrl.trim(),
      awayLogoUrl: matchForm.awayLogoUrl.trim(),
      live: matchForm.status === "live",
      status: matchForm.status === "completed" ? "completed" : (matchForm.status === "live" ? "today" : "upcoming"),
    };

    if (!payload.competition || !payload.date || !payload.home || !payload.away) {
      setMatchError("Fill in competition, date, home team, and away team.");
      setIsSavingMatch(false);
      return;
    }

    try {
      const response = await fetch(
        editingMatch ? `/api/matches/${editingMatch.id}` : "/api/matches",
        {
          method: editingMatch ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setMatchError(data.error || "Failed to save match.");
        return;
      }

      const data = await response.json();
      setMatches((prev) =>
        editingMatch
          ? prev.map((match) => (match.id === editingMatch.id ? data.match : match))
          : [...prev, data.match]
      );
      setEditingMatch(null);
      setMatchForm({
        competition: "FIFA World Cup 2026",
        date: getRelativeDateKey("today"),
        time: "",
        home: "",
        away: "",
        playerId: players[0]?.id || "1",
        homeLogoUrl: "",
        awayLogoUrl: "",
        status: "pending",
      });
    } catch (err) {
      setMatchError("An error occurred while saving the match.");
    } finally {
      setIsSavingMatch(false);
    }
  };

  const filteredMatches = matches.filter((match) => {
    const matchStatus = match.live ? "live" : (match.status === "completed" ? "completed" : deriveRuntimeMatchStatus(match.date));

    if (activeMatchFilter === "today") {
      return matchStatus === "today" || matchStatus === "live";
    }

    return matchStatus === activeMatchFilter;
  });

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col p-3 md:p-5 relative overflow-x-hidden animate-in fade-in duration-300">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

      <div className="w-full max-w-7xl mx-auto space-y-4 z-10 flex-grow flex flex-col">
        {/* Header section with live badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Tv className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent leading-none">
                ABC Sports Multiscreen Control Room
              </h1>
              <p className="text-[11px] text-slate-400 mt-1">
                Real-time multi-view monitoring dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none text-rose-400">
                Live Grid
              </span>
            </div>

            {activeTab === "players" ? (
              <button
                onClick={handleOpenBulkEdit}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-white/20 hover:bg-white/10"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Configure Streams</span>
              </button>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300">
                Match tools
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-1 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("matches")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              activeTab === "matches"
                ? "bg-white text-[#09090b]"
                : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Matches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("players")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              activeTab === "players"
                ? "bg-white text-[#09090b]"
                : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Players
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              activeTab === "settings"
                ? "bg-white text-[#09090b]"
                : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Settings
          </button>
        </div>

        {activeTab === "matches" && (
          <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
            <div className="rounded-2xl border border-white/5 bg-[#0f0f13] p-4 shadow-xl shadow-black/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4 text-violet-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    {editingMatch ? "Edit Match" : "Create Match"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewMatch}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 transition hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  New match
                </button>
              </div>

              <form onSubmit={handleCreateMatch} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Competition
                    </span>
                    <input
                      type="text"
                      value={matchForm.competition}
                      onChange={(e) =>
                        setMatchForm((prev) => ({ ...prev, competition: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50"
                    />
                    <p className="text-[10px] text-slate-500">Example: FIFA World Cup 2026</p>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Date
                    </span>
                    <input
                      type="date"
                      value={matchForm.date}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, date: e.target.value }))}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {}
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Pick any date.</p>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Time
                    </span>
                    <input
                      type="time"
                      value={matchForm.time}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, time: e.target.value }))}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {}
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Optional, but recommended.</p>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Home team
                    </span>
                    <input
                      type="text"
                      value={matchForm.home}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, home: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50"
                    />
                    <p className="text-[10px] text-slate-500">Team name shown on the card.</p>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Away team
                    </span>
                    <input
                      type="text"
                      value={matchForm.away}
                      onChange={(e) => setMatchForm((prev) => ({ ...prev, away: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50"
                    />
                    <p className="text-[10px] text-slate-500">Team name shown on the card.</p>
                  </label>
                </div>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Player
                  </span>
                  <select
                    value={matchForm.playerId}
                    onChange={(e) =>
                      setMatchForm((prev) => ({ ...prev, playerId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-500/50"
                  >
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">Clicking this match opens that player.</p>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Match / Stream Status
                  </span>
                  <select
                    value={matchForm.status}
                    onChange={(e) =>
                      setMatchForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-500/50 cursor-pointer"
                  >
                    <option value="pending" className="bg-[#09090b]">Scheduled (Link not added)</option>
                    <option value="live" className="bg-[#09090b]">Live (Link is ready)</option>
                    <option value="completed" className="bg-[#09090b]">Match Completed</option>
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Determines routing (Live -&gt; Player directly, Completed -&gt; Completion card).
                  </p>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Home logo URL
                    </span>
                    <input
                      type="url"
                      value={matchForm.homeLogoUrl}
                      onChange={(e) =>
                        setMatchForm((prev) => ({ ...prev, homeLogoUrl: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50"
                    />
                    <p className="text-[10px] text-slate-500">Optional direct image URL.</p>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Away logo URL
                    </span>
                    <input
                      type="url"
                      value={matchForm.awayLogoUrl}
                      onChange={(e) =>
                        setMatchForm((prev) => ({ ...prev, awayLogoUrl: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50"
                    />
                    <p className="text-[10px] text-slate-500">Optional direct image URL.</p>
                  </label>
                </div>
                {matchError ? (
                  <p className="text-xs font-medium text-rose-300">{matchError}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSavingMatch}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Plus className="h-4 w-4" />
                  {isSavingMatch ? "Saving..." : editingMatch ? "Update match" : "Create match"}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0f0f13] p-4 shadow-xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Tv className="h-4 w-4 text-sky-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Match List
                  </h2>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  SQLite
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["today", "upcoming", "completed"] as MatchStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveMatchFilter(status)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      activeMatchFilter === status
                        ? "bg-white text-[#09090b]"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {isMatchesLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading matches...
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-4 text-sm text-slate-400">
                    No {activeMatchFilter} matches yet.
                  </div>
                ) : (
                  filteredMatches.map((match) => {
                    const matchStatus = deriveRuntimeMatchStatus(match.date);

                    return (
                    <div
                      key={match.id}
                      className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                            {match.competition}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <TeamLogoThumb name={match.home} logoUrl={match.homeLogoUrl} />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                              vs
                            </span>
                            <TeamLogoThumb name={match.away} logoUrl={match.awayLogoUrl} />
                          </div>
                          <h3 className="mt-2 truncate text-base font-semibold text-white">
                            {match.home} vs {match.away}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatMatchDate(match.date)}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                            <span>{match.homeLogoUrl ? "Home logo set" : "Home logo missing"}</span>
                            <span>•</span>
                            <span>{match.awayLogoUrl ? "Away logo set" : "Away logo missing"}</span>
                            <span>•</span>
                            <span>
                              {players.find((player) => player.id === match.playerId)?.name ||
                                `Player ${match.playerId}`}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                              matchStatus === "live"
                                ? "bg-rose-500 text-white"
                                : matchStatus === "today"
                                ? "bg-rose-500/15 text-rose-300"
                                : matchStatus === "completed"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-white/5 text-slate-400"
                            }`}
                          >
                            {matchStatus}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenMatchEdit(match)}
                            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 transition hover:bg-white/10"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMatch(match)}
                            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-rose-300 transition hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "players" && (
          <>
            <div className="rounded-2xl border border-white/5 bg-[#0f0f13] p-4 shadow-xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Tv className="h-4 w-4 text-sky-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Players
                  </h2>
                </div>
                <button
                  onClick={handleOpenBulkEdit}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure Streams
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex-grow flex flex-col items-center justify-center py-40 gap-3">
                <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
                <p className="text-xs text-slate-400">Loading feeds...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {players.map((player) => {
                  const activeServer = getActiveServer(player);
                  const activeStreamUrl = activeServer?.url ?? "";

                  return (
                  <div
                    key={player.id}
                    className="group flex flex-col bg-[#0f0f13] border border-white/5 rounded-2xl p-3 hover:border-violet-500/20 hover:shadow-xl hover:shadow-violet-950/5 transition-all duration-300 relative overflow-hidden"
                  >
                {/* Header label for each player */}
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <Link
                    href={`/player/${player.id}`}
                    className="text-xs font-bold text-slate-200 flex items-center gap-1.5 hover:text-violet-400 hover:underline cursor-pointer group/title"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 group-hover:animate-pulse"></span>
                    <span>{player.name}</span>
                    <ExternalLink className="h-2.5 w-2.5 text-slate-500 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                  </Link>

                  <div className="flex items-center gap-2">
                    {/* Server Hot-Swap Switcher Pill Selector */}
                    {Object.keys(player.servers || {}).some((slot) => player.servers[slot]?.url) && (
                      <div className="flex max-w-[160px] items-center gap-0.5 overflow-x-auto bg-white/[0.02] border border-white/5 px-1 py-0.5 rounded-md mr-1 select-none">
                        {sortServerIds(player.servers).map((slot) => {
                          const hasUrl = !!player.servers[slot]?.url;
                          const isPrimary = (player.primaryServer || "1") === slot;
                          if (!hasUrl) return null;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={(e) => handleHotSwapPrimaryServer(player.id, slot, e)}
                              className={`text-[8px] font-extrabold min-w-4 h-4 px-1 flex items-center justify-center rounded transition-all active:scale-90 cursor-pointer ${
                                isPrimary
                                  ? "bg-violet-600 text-white shadow shadow-violet-500/30 font-extrabold"
                                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                              }`}
                              title={`Set ${player.servers[slot]?.name || `Server ${slot}`} as default feed`}
                            >
                              S{slot}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Copy Link Button */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyLink(player.id, e)}
                      className="flex items-center gap-1 text-[9px] font-medium text-slate-400 hover:text-white bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] px-2 py-0.5 rounded-md transition-all active:scale-95 duration-150 cursor-pointer"
                      title="Copy watch link"
                    >
                      {copiedId === player.id ? (
                        <>
                          <Check className="h-2.5 w-2.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-2.5 w-2.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {/* Configure Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenSingleEdit(player, e)}
                      className="flex items-center gap-1 text-[9px] font-medium text-slate-400 hover:text-white bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] px-2 py-0.5 rounded-md transition-all active:scale-95 duration-150 cursor-pointer"
                      title="Configure stream feed"
                    >
                      <Settings className="h-2.5 w-2.5" />
                      <span>Configure</span>
                    </button>

                    {/* Status Badge */}
                    {activeStreamUrl ? (
                      <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full select-none">
                        {activeServer?.isIframe ? "IFRAME" : "ACTIVE"}
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full select-none">
                        OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                {/* Video Player or Offline Placeholder */}
                {activeStreamUrl ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black/90">
                    <VideoPlayer
                      src={activeStreamUrl}
                      title={player.name}
                      isIframe={activeServer?.isIframe === true}
                      muted={true}
                      autoPlay={true}
                    />
                  </div>
                ) : (
                  <Link
                    href={`/player/${player.id}`}
                    className="aspect-video w-full rounded-xl border border-dashed border-white/5 bg-black/40 flex flex-col items-center justify-center p-4 text-slate-600 relative overflow-hidden select-none hover:bg-violet-950/5 hover:border-violet-500/20 transition-all duration-300"
                  >
                    <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none"></div>
                    <svg className="w-7 h-7 text-slate-700 mb-2.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 0A3.75 3.75 0 0 0 12 18Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 0 0-15 0" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 12a9.75 9.75 0 0 0-19.5 0" />
                    </svg>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">
                      No Signal
                    </span>
                  </Link>
                )}
              </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "settings" && (
          <section className="mx-auto w-full max-w-3xl animate-in fade-in duration-300">
            <div className="rounded-2xl border border-white/5 bg-[#0f0f13] p-6 shadow-xl shadow-black/10">
              <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-6">
                <Settings className="h-5 w-5 text-violet-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Global App Settings
                </h2>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <label className="space-y-1.5 block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    WhatsApp Group Join Link
                  </span>
                  <input
                    type="url"
                    value={whatsappUrl}
                    onChange={(e) => setWhatsappUrl(e.target.value)}
                    placeholder="https://chat.whatsapp.com/your-group-id"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500/50"
                  />
                  <p className="text-[10px] text-slate-500">
                    Enter the WhatsApp Group invitation URL. Leaving it blank hides the join button from the homepage, match details, and player views.
                  </p>
                </label>

                {settingsError && (
                  <p className="text-xs font-medium text-rose-400 bg-rose-500/5 py-2 px-3 rounded-lg border border-rose-500/10">
                    {settingsError}
                  </p>
                )}

                {settingsSuccess && (
                  <p className="text-xs font-medium text-emerald-400 bg-emerald-500/5 py-2 px-3 rounded-lg border border-emerald-500/10">
                    Settings saved successfully!
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-violet-500/10 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingSettings ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save Settings
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-5 rounded-2xl border border-white/5 bg-[#0f0f13] p-6 shadow-xl shadow-black/10">
              <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-6">
                <Megaphone className="h-5 w-5 text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Broadcast Message
                </h2>
              </div>

              <form onSubmit={handleSaveBroadcast} className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Broadcast visibility</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      When enabled, the popup appears on all public client pages.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBroadcastIsActive((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                      broadcastIsActive
                        ? "border-amber-400/40 bg-amber-400"
                        : "border-white/10 bg-slate-800"
                    }`}
                    aria-pressed={broadcastIsActive}
                    aria-label="Toggle broadcast visibility"
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        broadcastIsActive ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 block md:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Title
                    </span>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="Breaking update"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
                    />
                  </label>

                  <label className="space-y-1.5 block md:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Description
                    </span>
                    <textarea
                      value={broadcastDescription}
                      onChange={(e) => setBroadcastDescription(e.target.value)}
                      rows={4}
                      placeholder="Tell viewers what changed."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
                    />
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Action button label
                    </span>
                    <input
                      type="text"
                      value={broadcastActionLabel}
                      onChange={(e) => setBroadcastActionLabel(e.target.value)}
                      placeholder="Open link"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
                    />
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Action link
                    </span>
                    <input
                      type="url"
                      value={broadcastActionUrl}
                      onChange={(e) => setBroadcastActionUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
                    />
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Cancel button label
                    </span>
                    <input
                      type="text"
                      value={broadcastCancelLabel}
                      onChange={(e) => setBroadcastCancelLabel(e.target.value)}
                      placeholder="Close"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="h-4 w-4 text-amber-300" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-white">
                      Photos
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {broadcastImageUrls.map((url, index) => (
                      <label key={`broadcast-image-${index}`} className="space-y-1.5 block">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Photo {index + 1}
                        </span>
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => updateBroadcastImageUrl(index, e.target.value)}
                          placeholder="https://example.com/photo.jpg"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {broadcastError && (
                  <p className="text-xs font-medium text-rose-400 bg-rose-500/5 py-2 px-3 rounded-lg border border-rose-500/10">
                    {broadcastError}
                  </p>
                )}

                {broadcastSuccess && (
                  <p className="text-xs font-medium text-emerald-400 bg-emerald-500/5 py-2 px-3 rounded-lg border border-emerald-500/10">
                    Broadcast message saved successfully.
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDisableBroadcast}
                    disabled={isSavingBroadcast}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                    Disable broadcast
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingBroadcast}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/10 transition hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSavingBroadcast ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {broadcastIsActive ? "Publish broadcast" : "Save draft"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Footnote information */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 px-1 py-4 border-t border-white/5 gap-2 mt-auto">
          <p className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            Click S1-S4 to hot-swap active feeds. Click &quot;Configure&quot; to update stream sources.
          </p>
          <p>Powered by Vidstack & Next.js</p>
        </div>
      </div>

      {/* Focused Single Player Configure Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-violet-500" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Configure {editingPlayer.name}
                </h2>
              </div>
              <button
                onClick={() => setEditingPlayer(null)}
                className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Form wrapping scrollable content and fixed actions */}
            <form onSubmit={handleSaveConfig} className="flex flex-col flex-1 min-h-0 mt-4">
              {/* Scrollable Form Body */}
              <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1 mb-4">
                {sortServerIds(inputUrls).map((slot) => (
                  <div key={slot} className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-violet-400">Server Slot {slot}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingPrimaryServer(slot)}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all border cursor-pointer ${
                            editingPrimaryServer === slot
                              ? "bg-violet-600 border-violet-500 text-white"
                              : "border-white/10 hover:border-white/20 text-slate-450 text-slate-400 hover:text-white"
                          }`}
                        >
                          {editingPrimaryServer === slot ? "★ Primary Feed" : "Set Primary"}
                        </button>
                        {inputUrls[slot].url && (
                          <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Active
                          </span>
                        )}
                        {sortServerIds(inputUrls).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveInlineServer(slot)}
                            className="px-2 py-0.5 rounded text-[8px] font-bold transition-all border border-rose-500/20 text-rose-300 hover:text-white hover:bg-rose-500/10 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Label</label>
                        <input
                          type="text"
                          value={inputUrls[slot].name}
                          onChange={(e) => handleInlineNameChange(slot, e.target.value)}
                          placeholder={`Server ${slot}`}
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            {inputUrls[slot].isIframe ? "Iframe / HTML URL" : "Stream URL"}
                          </label>
                          <button
                            type="button"
                            onClick={() => handleInlineIframeToggle(slot)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
                              inputUrls[slot].isIframe
                                ? "border-sky-400/40 bg-sky-500"
                                : "border-white/10 bg-slate-800"
                            }`}
                            aria-pressed={inputUrls[slot].isIframe === true}
                            aria-label={`Toggle iframe mode for server slot ${slot}`}
                            title="Show this URL inside an iframe"
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                                inputUrls[slot].isIframe ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={inputUrls[slot].url}
                          onChange={(e) => handleInlineUrlChange(slot, e.target.value)}
                          placeholder={inputUrls[slot].isIframe ? "https://example.com/embed/player.html" : "https://example.com/stream.m3u8"}
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 font-mono"
                        />
                        <p className="mt-1 text-[9px] text-slate-500">
                          {inputUrls[slot].isIframe ? "Iframe mode embeds this page directly in the player frame." : "Stream mode plays HLS/m3u8 or direct media URLs."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddInlineServer}
                  className="w-full rounded-xl border border-dashed border-violet-500/25 bg-violet-500/5 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-violet-300 hover:bg-violet-500/10 hover:text-white transition-all cursor-pointer"
                >
                  + Add Stream Server
                </button>

                {saveError && (
                  <div className="text-rose-400 text-[10px] bg-rose-500/5 py-2 px-3 rounded-lg border border-rose-500/10">
                    <span>{saveError}</span>
                  </div>
                )}
              </div>

              {/* Fixed Action Footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-violet-500/10 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Bulk Configure Modal Panel (With Player Tabs) */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] min-h-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-violet-500" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Configure All Streams
                </h2>
              </div>
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Modal Player Navigation Tabs */}
            <div className="flex border-b border-white/5 mt-4 gap-1">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveBulkTab(p.id)}
                  className="px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer"
                  style={{
                    borderColor: activeBulkTab === p.id ? "#8b5cf6" : "transparent",
                    color: activeBulkTab === p.id ? "#ffffff" : "#94a3b8",
                    backgroundColor: activeBulkTab === p.id ? "rgba(255,255,255,0.02)" : "transparent"
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Form wrapping scrollable content and fixed actions */}
            <form onSubmit={handleSaveBulk} className="flex flex-col flex-1 min-h-0 mt-4">
              {/* Scrollable Form Body */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-2 space-y-3 mb-4">
                {sortServerIds(bulkInputUrls[activeBulkTab] ?? createEditableServers()).map((slot) => (
                  <div key={slot} className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-violet-400">Server Slot {slot}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleBulkPrimaryServerChange(activeBulkTab, slot)}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all border cursor-pointer ${
                            (bulkPrimaryServers[activeBulkTab] || "1") === slot
                              ? "bg-violet-600 border-violet-500 text-white"
                              : "border-white/10 hover:border-white/20 text-slate-450 text-slate-400 hover:text-white"
                          }`}
                        >
                          {(bulkPrimaryServers[activeBulkTab] || "1") === slot ? "★ Primary Feed" : "Set Primary"}
                        </button>
                        {bulkInputUrls[activeBulkTab]?.[slot]?.url && (
                          <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Active
                          </span>
                        )}
                        {sortServerIds(bulkInputUrls[activeBulkTab] ?? createEditableServers()).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBulkServer(activeBulkTab, slot)}
                            className="px-2 py-0.5 rounded text-[8px] font-bold transition-all border border-rose-500/20 text-rose-300 hover:text-white hover:bg-rose-500/10 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Label</label>
                        <input
                          type="text"
                          value={bulkInputUrls[activeBulkTab]?.[slot]?.name ?? ""}
                          onChange={(e) => handleBulkNameChange(activeBulkTab, slot, e.target.value)}
                          placeholder={`Server ${slot}`}
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            {bulkInputUrls[activeBulkTab]?.[slot]?.isIframe ? "Iframe / HTML URL" : "Stream URL"}
                          </label>
                          <button
                            type="button"
                            onClick={() => handleBulkIframeToggle(activeBulkTab, slot)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
                              bulkInputUrls[activeBulkTab]?.[slot]?.isIframe
                                ? "border-sky-400/40 bg-sky-500"
                                : "border-white/10 bg-slate-800"
                            }`}
                            aria-pressed={bulkInputUrls[activeBulkTab]?.[slot]?.isIframe === true}
                            aria-label={`Toggle iframe mode for server slot ${slot}`}
                            title="Show this URL inside an iframe"
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                                bulkInputUrls[activeBulkTab]?.[slot]?.isIframe ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={bulkInputUrls[activeBulkTab]?.[slot]?.url ?? ""}
                          onChange={(e) => handleBulkUrlChange(activeBulkTab, slot, e.target.value)}
                          placeholder={
                            bulkInputUrls[activeBulkTab]?.[slot]?.isIframe
                              ? "https://example.com/embed/player.html"
                              : "https://example.com/stream.m3u8"
                          }
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 font-mono"
                        />
                        <p className="mt-1 text-[9px] text-slate-500">
                          {bulkInputUrls[activeBulkTab]?.[slot]?.isIframe
                            ? "Iframe mode embeds this page directly in the player frame."
                            : "Stream mode plays HLS/m3u8 or direct media URLs."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => handleAddBulkServer(activeBulkTab)}
                  className="w-full rounded-xl border border-dashed border-violet-500/25 bg-violet-500/5 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-violet-300 hover:bg-violet-500/10 hover:text-white transition-all cursor-pointer"
                >
                  + Add Stream Server
                </button>

                {saveError && (
                  <div className="flex items-center gap-2 text-rose-400 text-[10px] bg-rose-500/5 py-2 px-3 rounded-lg border border-rose-500/10">
                    <span>{saveError}</span>
                  </div>
                )}
              </div>

              {/* Fixed Action Footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-violet-500/10 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Configurations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
