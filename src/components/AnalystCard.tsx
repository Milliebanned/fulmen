"use client";

import { useApp } from "@/lib/store";

/** Glassy blue assistant card: the AI-written (or template) rationale for the selected idea. */
export function AnalystCard() {
  const { idea, ai, aiLoading } = useApp();
  if (!idea) return null;
  return (
    <section className="glass-blue relative overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2a4fb0]">
        <span>Fulmen analyst</span>
        <span>{ai?.source === "gemini" ? "Gemini" : ai?.source === "claude" ? "Claude" : aiLoading ? "auto summary · AI refining…" : "auto summary"}</span>
      </div>
      <div className="mb-3 flex justify-center py-2">
        <div className="orb" />
      </div>
      <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
        <div className="mb-1 text-[11px] font-bold text-[#1d49c4]">
          {idea.market.name} {idea.side.toUpperCase()} · {idea.conviction}/100
        </div>
        <p className="text-[13px] leading-relaxed text-ink/90">
          {ai && ai.symbol === idea.market.symbol ? ai.text : aiLoading ? "Reading the live numbers…" : "—"}
        </p>
      </div>
      <p className="mt-2 text-[10px] text-[#2a4fb0]/80">Cites only live Strike data. Not financial advice.</p>
    </section>
  );
}
