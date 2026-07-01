"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/video-player";
import { Tv, Sparkles, Loader2, Copy, Check, Settings, Lock, Save, ExternalLink, X, Link2 } from "lucide-react";

interface PlayerConfig {
  id: string;
  name: string;
  url: string;
}

export default function DashboardPage() {
  const [players, setPlayers] = useState<PlayerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Authorization State (Kept to lock the entire dashboard)
  const [passcode, setPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");

  // Inline Configuration State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Bulk Configuration State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkInputUrls, setBulkInputUrls] = useState<{ [key: string]: string }>({});

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load passcode verification status from sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("dashboard_authorized");
      if (auth === "true") {
        setIsAuthorized(true);
      }
    }
  }, []);

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

  const handleToggleEdit = (player: PlayerConfig, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering details card navigation
    setEditingPlayerId(player.id);
    setInputUrl(player.url);
    setSaveError("");
  };

  const handleOpenBulkEdit = () => {
    const urls: { [key: string]: string } = {};
    players.forEach((p) => {
      urls[p.id] = p.url;
    });
    setBulkInputUrls(urls);
    setSaveError("");
    setIsBulkEditOpen(true);
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === "23929199") {
      setIsAuthorized(true);
      setPasscodeError("");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("dashboard_authorized", "true");
      }
    } else {
      setPasscodeError("Incorrect passcode.");
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");

    // Simple URL validation
    if (inputUrl) {
      try {
        const parsed = new URL(inputUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          setSaveError("Invalid protocol. Use http/https.");
          setIsSaving(false);
          return;
        }
      } catch {
        setSaveError("Please enter a valid URL.");
        setIsSaving(false);
        return;
      }
    }

    try {
      const updatedPlayers = players.map((p) =>
        p.id === editingPlayerId ? { ...p, url: inputUrl } : p
      );

      const response = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPlayers),
      });

      if (response.ok) {
        setPlayers(updatedPlayers);
        setEditingPlayerId(null);
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

  const handleBulkUrlChange = (id: string, newUrl: string) => {
    setBulkInputUrls((prev) => ({
      ...prev,
      [id]: newUrl,
    }));
  };

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");

    // Validate all input URLs
    const hasInvalidUrl = Object.values(bulkInputUrls).some((url) => {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        return !["http:", "https:"].includes(parsed.protocol);
      } catch {
        return true;
      }
    });

    if (hasInvalidUrl) {
      setSaveError("Please enter valid stream URLs (starting with http/https).");
      setIsSaving(false);
      return;
    }

    try {
      const updatedPlayers = players.map((p) => ({
        ...p,
        url: bulkInputUrls[p.id] ?? p.url,
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

  // Render Passcode Screen if Not Authorized
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

        <div className="w-full max-w-md mx-auto z-10 py-12 animate-in fade-in duration-300">
          <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl relative flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-4">
              <Lock className="h-5 w-5 text-violet-400" />
            </div>

            <h2 className="text-base font-bold tracking-tight text-white mb-1">
              Control Room Access
            </h2>
            <p className="text-[10px] text-slate-400 text-center mb-6">
              Enter passcode to unlock multiscreen broadcast dashboard
            </p>

            <form onSubmit={handlePasscodeSubmit} className="w-full space-y-4">
              <div>
                <input
                  type="password"
                  name="control-room-access-passcode"
                  autoComplete="new-password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter Passcode"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/5 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-center tracking-widest text-white transition-all"
                  autoFocus
                />
              </div>

              {passcodeError && (
                <div className="flex items-center gap-2 text-rose-400 text-xs justify-center bg-rose-500/5 py-2 px-3 rounded-lg border border-rose-500/10">
                  <span>{passcodeError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-violet-500/10 active:scale-95 transition-all duration-150 cursor-pointer"
              >
                Unlock Dashboard
              </button>
            </form>

            <Link
              href="/"
              className="text-[10px] text-slate-500 hover:text-slate-300 mt-6 flex items-center gap-1.5 transition-all"
            >
              Cancel & Go Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Render Full Dashboard Grid Screen if Authorized
  return (
    <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col p-4 md:p-8 relative overflow-x-hidden animate-in fade-in duration-300">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

      <div className="w-full max-w-7xl mx-auto space-y-6 z-10 flex-grow flex flex-col">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      onClick={(e) => handleToggleEdit(player, e)}
                      className="flex items-center gap-1 text-[9px] font-medium text-slate-400 hover:text-white bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] px-2 py-0.5 rounded-md transition-all active:scale-95 duration-150 cursor-pointer"
                      title="Configure stream feed"
                    >
                      <Settings className="h-2.5 w-2.5" />
                      <span>Configure</span>
                    </button>

                    {/* Status Badge */}
                    {player.url ? (
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

                {/* Video Player, Config Form, or Offline Placeholder */}
                {editingPlayerId === player.id ? (
                  <div className="aspect-video w-full rounded-xl bg-black/60 border border-violet-500/20 p-4 flex flex-col justify-center relative select-none">
                    <form onSubmit={handleSaveConfig} className="w-full space-y-2 flex flex-col">
                      <span className="text-[9px] font-bold text-slate-300 mb-0.5 flex items-center gap-1.5">
                        <Settings className="h-3 w-3 text-violet-400" />
                        Configure Stream Source
                      </span>
                      <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="Stream URL (https://.../stream.m3u8)"
                        className="w-full px-2.5 py-1 bg-black/80 border border-white/5 rounded-md text-[10px] placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-slate-100 transition-all font-mono"
                        autoFocus
                      />
                      {saveError && (
                        <span className="text-[8px] text-rose-400 font-semibold">{saveError}</span>
                      )}
                      <div className="flex gap-2 w-full mt-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingPlayerId(null)}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-md transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="px-3 py-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-[9px] font-bold text-white rounded-md transition-all flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          {isSaving ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Save className="h-2.5 w-2.5" />
                          )}
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                ) : player.url ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black/90">
                    <VideoPlayer
                      src={player.url}
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
            Click on a feed title to watch that single channel. Click "Configure" to update stream sources.
          </p>
          <p>Powered by Vidstack & Next.js</p>
        </div>
      </div>

      {/* Main Bulk Configure Modal Panel */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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

            {/* Modal Body */}
            <div className="overflow-y-auto pr-1 py-2 space-y-4 my-4 flex-grow">
              <form onSubmit={handleSaveBulk} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="group flex flex-col gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.02] transition-all duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-md bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-[9px] font-bold text-violet-400">
                          {player.id}
                        </div>
                        <label className="text-[11px] font-semibold text-slate-200">
                          {player.name}
                        </label>
                      </div>
                      <div className="relative flex items-center">
                        <Link2 className="absolute left-2.5 h-3 w-3 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                        <input
                          type="text"
                          value={bulkInputUrls[player.id] ?? ""}
                          onChange={(e) => handleBulkUrlChange(player.id, e.target.value)}
                          placeholder="Stream URL (https://.../stream.m3u8)"
                          className="w-full pl-8 pr-2 py-1.5 bg-black/60 border border-white/5 rounded-lg text-[10px] placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-slate-100 transition-all font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {saveError && (
                  <div className="flex items-center gap-2 text-rose-400 text-[10px] bg-rose-500/5 py-2 px-3 rounded-lg border border-rose-500/10">
                    <span>{saveError}</span>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-6">
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
        </div>
      )}
    </main>
  );
}
