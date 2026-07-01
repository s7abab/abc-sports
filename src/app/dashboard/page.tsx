"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/video-player";
import { Tv, Sparkles, Loader2, Copy, Check, Settings, Save, ExternalLink, X } from "lucide-react";

interface PlayerConfig {
  id: string;
  name: string;
  primaryServer: string;
  servers: {
    "1": { name: string; url: string };
    "2": { name: string; url: string };
    "3": { name: string; url: string };
    "4": { name: string; url: string };
  };
}

export default function DashboardPage() {
  const [players, setPlayers] = useState<PlayerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Single Player Configuration Modal State
  const [editingPlayer, setEditingPlayer] = useState<PlayerConfig | null>(null);
  const [inputUrls, setInputUrls] = useState<{
    "1": { name: string; url: string };
    "2": { name: string; url: string };
    "3": { name: string; url: string };
    "4": { name: string; url: string };
  }>({
    "1": { name: "", url: "" },
    "2": { name: "", url: "" },
    "3": { name: "", url: "" },
    "4": { name: "", url: "" },
  });
  const [editingPrimaryServer, setEditingPrimaryServer] = useState<string>("1");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Bulk Configuration Modal State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [activeBulkTab, setActiveBulkTab] = useState<string>("1");
  const [bulkInputUrls, setBulkInputUrls] = useState<{
    [key: string]: {
      "1": { name: string; url: string };
      "2": { name: string; url: string };
      "3": { name: string; url: string };
      "4": { name: string; url: string };
    };
  }>({});
  const [bulkPrimaryServers, setBulkPrimaryServers] = useState<{ [key: string]: string }>({});

  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    fetchPlayers();
  }, []);

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
    setInputUrls({
      "1": { name: player.servers?.["1"]?.name || "", url: player.servers?.["1"]?.url || "" },
      "2": { name: player.servers?.["2"]?.name || "", url: player.servers?.["2"]?.url || "" },
      "3": { name: player.servers?.["3"]?.name || "", url: player.servers?.["3"]?.url || "" },
      "4": { name: player.servers?.["4"]?.name || "", url: player.servers?.["4"]?.url || "" },
    });
    setEditingPrimaryServer(player.primaryServer || "1");
    setSaveError("");
  };

  const handleOpenBulkEdit = () => {
    const urls: {
      [key: string]: {
        "1": { name: string; url: string };
        "2": { name: string; url: string };
        "3": { name: string; url: string };
        "4": { name: string; url: string };
      };
    } = {};
    const primaryServers: { [key: string]: string } = {};

    players.forEach((p) => {
      urls[p.id] = {
        "1": { name: p.servers?.["1"]?.name || "", url: p.servers?.["1"]?.url || "" },
        "2": { name: p.servers?.["2"]?.name || "", url: p.servers?.["2"]?.url || "" },
        "3": { name: p.servers?.["3"]?.name || "", url: p.servers?.["3"]?.url || "" },
        "4": { name: p.servers?.["4"]?.name || "", url: p.servers?.["4"]?.url || "" },
      };
      primaryServers[p.id] = p.primaryServer || "1";
    });
    setBulkInputUrls(urls);
    setBulkPrimaryServers(primaryServers);
    setSaveError("");
    if (players.length > 0) {
      setActiveBulkTab(players[0].id);
    }
    setIsBulkEditOpen(true);
  };

  const handleInlineUrlChange = (slot: "1" | "2" | "3" | "4", val: string) => {
    setInputUrls((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        url: val,
      },
    }));
  };

  const handleInlineNameChange = (slot: "1" | "2" | "3" | "4", val: string) => {
    setInputUrls((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        name: val,
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
      const updatedPlayers = players.map((p) =>
        p.id === editingPlayer.id ? { ...p, servers: inputUrls, primaryServer: editingPrimaryServer } : p
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

  const handleBulkUrlChange = (playerId: string, slot: "1" | "2" | "3" | "4", val: string) => {
    setBulkInputUrls((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [slot]: {
          ...prev[playerId][slot],
          url: val,
        },
      },
    }));
  };

  const handleBulkNameChange = (playerId: string, slot: "1" | "2" | "3" | "4", val: string) => {
    setBulkInputUrls((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [slot]: {
          ...prev[playerId][slot],
          name: val,
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
      const updatedPlayers = players.map((p) => ({
        ...p,
        servers: bulkInputUrls[p.id] || p.servers,
        primaryServer: bulkPrimaryServers[p.id] || p.primaryServer,
      }));

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

  const getActiveStreamUrl = (player: PlayerConfig): string => {
    if (!player.servers) return "";
    const primary = player.primaryServer || "1";
    if (player.servers[primary as "1" | "2" | "3" | "4"]?.url) {
      return player.servers[primary as "1" | "2" | "3" | "4"].url;
    }
    return player.servers["1"]?.url || player.servers["2"]?.url || player.servers["3"]?.url || player.servers["4"]?.url || "";
  };

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
            {/* Live Indicator */}
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 px-3 py-1.5 rounded-xl">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest leading-none">
                Live Grid
              </span>
            </div>

            {/* Main Configure Button (Top Right) */}
            <button
              onClick={handleOpenBulkEdit}
              className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs font-semibold text-slate-200 rounded-xl transition-all duration-200 cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Configure Streams</span>
            </button>
          </div>
        </div>

        {/* Players Grid */}
        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-40 gap-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            <p className="text-xs text-slate-400">Loading feeds...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {players.map((player) => (
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
                    {Object.keys(player.servers || {}).some((slot) => player.servers[slot as "1" | "2" | "3" | "4"]?.url) && (
                      <div className="flex items-center gap-0.5 bg-white/[0.02] border border-white/5 px-1 py-0.5 rounded-md mr-1 select-none">
                        {(["1", "2", "3", "4"] as const).map((slot) => {
                          const hasUrl = !!player.servers[slot]?.url;
                          const isPrimary = (player.primaryServer || "1") === slot;
                          if (!hasUrl) return null;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={(e) => handleHotSwapPrimaryServer(player.id, slot, e)}
                              className={`text-[8px] font-extrabold w-4 h-4 flex items-center justify-center rounded transition-all active:scale-90 cursor-pointer ${
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
                    {getActiveStreamUrl(player) ? (
                      <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full select-none">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full select-none">
                        OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                {/* Video Player or Offline Placeholder */}
                {getActiveStreamUrl(player) ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black/90">
                    <VideoPlayer
                      src={getActiveStreamUrl(player)}
                      title={player.name}
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
            ))}
          </div>
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
                {(["1", "2", "3", "4"] as const).map((slot) => (
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
                        <label className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">HLS URL</label>
                        <input
                          type="text"
                          value={inputUrls[slot].url}
                          onChange={(e) => handleInlineUrlChange(slot, e.target.value)}
                          placeholder="https://example.com/stream.m3u8"
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}

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
                {(["1", "2", "3", "4"] as const).map((slot) => (
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
                        <label className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">HLS URL</label>
                        <input
                          type="text"
                          value={bulkInputUrls[activeBulkTab]?.[slot]?.url ?? ""}
                          onChange={(e) => handleBulkUrlChange(activeBulkTab, slot, e.target.value)}
                          placeholder="https://example.com/stream.m3u8"
                          className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}

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
