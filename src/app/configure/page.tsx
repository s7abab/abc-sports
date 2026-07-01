"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Link2, CheckCircle2, AlertCircle, Loader2, Lock, ShieldAlert } from "lucide-react";

interface PlayerConfig {
  id: string;
  name: string;
  url: string;
}

function ConfigureForm() {
  const [players, setPlayers] = useState<PlayerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Authentication State
  const [passcode, setPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");

  const searchParams = useSearchParams();
  const filterId = searchParams.get("id");

  // Check sessionStorage for previous authorization in this session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("config_authorized");
      if (auth === "true") {
        setIsAuthorized(true);
      }
    }
  }, []);

  // Fetch current configuration
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const response = await fetch("/api/players");
        if (response.ok) {
          const data = await response.json();
          setPlayers(data);
        } else {
          setStatus({ type: "error", message: "Failed to load player configurations." });
        }
      } catch (err) {
        setStatus({ type: "error", message: "An error occurred while loading settings." });
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === "23929199") {
      setIsAuthorized(true);
      setPasscodeError("");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("config_authorized", "true");
      }
    } else {
      setPasscodeError("Incorrect passcode. Access denied.");
    }
  };

  const handleUrlChange = (id: string, newUrl: string) => {
    setPlayers((prev) =>
      prev.map((player) => (player.id === id ? { ...player, url: newUrl } : player))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus(null);

    // Basic URL validation
    const invalidUrl = players.some((player) => {
      if (!player.url) return false; // Empty is fine (means offline)
      try {
        const parsed = new URL(player.url);
        return !["http:", "https:"].includes(parsed.protocol);
      } catch {
        return true;
      }
    });

    if (invalidUrl) {
      setStatus({
        type: "error",
        message: "Please enter valid stream URLs (e.g. starting with http:// or https://)",
      });
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(players),
      });

      if (response.ok) {
        setStatus({ type: "success", message: "Configuration saved successfully!" });
        // Clear success toast after 3 seconds
        setTimeout(() => setStatus(null), 3000);
      } else {
        const data = await response.json();
        setStatus({ type: "error", message: data.error || "Failed to save configuration." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "An error occurred while saving configuration." });
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if a specific filter is applied, and check if that player exists
  const isFiltering = !!(filterId && players.some((p) => p.id === filterId));
  const visiblePlayers = isFiltering
    ? players.filter((p) => p.id === filterId)
    : players;

  // Render Passcode Screen if Not Authorized
  if (!isAuthorized) {
    return (
      <div className="w-full max-w-md mx-auto z-10 py-12 animate-in fade-in duration-300">
        <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl relative flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <Lock className="h-5 w-5 text-violet-400" />
          </div>

          <h2 className="text-base font-bold tracking-tight text-white mb-1">
            Restricted Configuration
          </h2>
          <p className="text-[10px] text-slate-400 text-center mb-6">
            Enter passcode to unlock broadcast feed management
          </p>

          <form onSubmit={handlePasscodeSubmit} className="w-full space-y-4">
            <div>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter Passcode"
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/5 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-center tracking-widest text-white transition-all"
                autoFocus
              />
            </div>

            {passcodeError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs justify-center bg-rose-500/5 py-2 px-3 rounded-lg border border-rose-500/10">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{passcodeError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-violet-500/10 active:scale-95 transition-all duration-150"
            >
              Verify Passcode
            </button>
          </form>

          <Link
            href="/"
            className="text-[10px] text-slate-500 hover:text-slate-300 mt-6 flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="h-3 w-3" />
            Cancel & Return to Grid
          </Link>
        </div>
      </div>
    );
  }

  // Render Full Configuration Screen if Authorized
  return (
    <div className="w-full max-w-4xl space-y-6 z-10 animate-in fade-in zoom-in-95 duration-350">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-200"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-slate-300" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent leading-none">
              Configure {isFiltering ? `${visiblePlayers[0]?.name}` : "Streams"}
            </h1>
            <p className="text-[11px] text-slate-400 mt-1">
              {isFiltering
                ? `Updating the broadcast source for ${visiblePlayers[0]?.name}`
                : "Manage live HLS broadcast sources for all 8 player slots"}
            </p>
          </div>
        </div>

        {isFiltering && (
          <Link
            href="/configure"
            className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-xl transition-all self-start sm:self-auto"
          >
            Configure All 8 Players
          </Link>
        )}
      </div>

      {/* Status banner */}
      {status && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            status.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p className="font-medium">{status.message}</p>
        </div>
      )}

      {/* Config Form */}
      <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            <p className="text-xs text-slate-400">Loading configurations from server...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className={isFiltering ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 md:grid-cols-2 gap-5"}>
              {visiblePlayers.map((player) => {
                const mainIndex = players.findIndex((p) => p.id === player.id);
                return (
                  <div
                    key={player.id}
                    className="group flex flex-col gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.03] transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">
                          {mainIndex + 1}
                        </div>
                        <label className="text-xs font-semibold text-slate-200">
                          {player.name}
                        </label>
                      </div>
                      {isFiltering && (
                        <span className="text-[10px] text-slate-500">
                          Currently configuring
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <Link2 className="absolute left-3 h-3.5 w-3.5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                      <input
                        type="text"
                        value={player.url}
                        onChange={(e) => handleUrlChange(player.id, e.target.value)}
                        placeholder="HLS Stream URL (e.g. https://.../stream.m3u8)"
                        className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/5 rounded-lg text-xs placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-slate-100"
                        autoFocus={isFiltering}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submit panel */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
              <p className="text-[10px] text-slate-500 max-w-md">
                Changes will take effect instantly for all active dashboard sessions once saved. Keep fields empty to set slots as offline.
              </p>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-violet-500/10 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ConfigurePage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col items-center p-4 md:p-8 relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

      <Suspense
        fallback={
          <div className="w-full max-w-4xl flex flex-col items-center justify-center py-40 gap-3 z-10">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            <p className="text-xs text-slate-400">Loading settings...</p>
          </div>
        }
      >
        <ConfigureForm />
      </Suspense>
    </main>
  );
}
