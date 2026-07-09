import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#06070b] px-6 py-16 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_32%)]" />
      <section className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-amber-500/10 text-amber-300">
          <TriangleAlert className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-3 text-sm font-black uppercase tracking-[0.35em] text-amber-300">
          Page not found
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          That route does not exist.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          The link may be outdated, or the app may have been opened on a path that is no longer
          available. Return home or open the offline page if the connection is unstable.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.02] hover:bg-red-100"
          >
            Go home
          </Link>
          <Link
            href="/offline"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-black text-slate-100 transition hover:scale-[1.02] hover:bg-white/10"
          >
            Open offline page
          </Link>
        </div>
      </section>
    </main>
  );
}
