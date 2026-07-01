export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/20 via-[#09090b] to-[#09090b] pointer-events-none z-0"></div>

      <div className="z-10 flex flex-col items-center gap-3">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent select-none uppercase">
          ABC Sports
        </h1>
      </div>
    </main>
  );
}
