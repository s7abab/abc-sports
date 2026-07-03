import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ShakaClearKeyPlayer } from "@/components/shaka-clear-key-player";

export default function ShakPlayerPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#09090b] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.24),transparent_46%),linear-gradient(135deg,rgba(15,23,42,0.75),rgba(9,9,11,0.2)_42%,rgba(6,78,59,0.12))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-2 px-4 pb-3 pt-0 sm:px-6 sm:pb-4 lg:px-8">
        <header className="flex items-center rounded-2xl border border-white/[0.07] bg-white/[0.035] p-1.5 shadow-xl shadow-black/20 backdrop-blur-md sm:p-2">
          <Link
            href="/"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/40 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/20 transition hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back</span>
          </Link>
        </header>

        <section className="flex flex-1 flex-col gap-2">
          <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/12 via-white/[0.035] to-emerald-500/10 p-2 shadow-2xl shadow-black/40 ring-1 ring-white/[0.03] sm:p-3">
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.16),transparent_34%)]" />
            <div className="relative">
              <ShakaClearKeyPlayer />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
