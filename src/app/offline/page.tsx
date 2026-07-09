import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#06070b] px-6 py-16 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_32%)]" />
      <section className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-red-500/10 text-red-300">
          <WifiOff className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-3 text-sm font-black uppercase tracking-[0.35em] text-red-300">
          Offline
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Live sports need a connection.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          ABC Sports can open as an installed app, but match data and streams are loaded live. Reconnect
          to refresh schedules, watch players, and manage broadcasts.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.02] hover:bg-red-100"
        >
          Try home again
        </Link>
      </section>
    </main>
  );
}
