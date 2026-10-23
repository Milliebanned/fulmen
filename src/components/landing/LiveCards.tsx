"use client";

// Small live proof-points floating around the hero. Real Strike data; renders nothing if the API is unreachable.

import { useEffect, useState } from "react";
import { fetchMarkets, fetchSummary } from "@/lib/strike";
import { fmt, price } from "@/lib/signals";

interface Live {
  btc: number | null;
  fund: { name: string; apr: number } | null;
  traders: number | null;
  volume: number | null;
}

export function LiveCards() {
  const [d, setD] = useState<Live | null>(null);

  useEffect(() => {
    let off = false;
    Promise.all([fetchMarkets().catch(() => null), fetchSummary().catch(() => null)]).then(([mk, sum]) => {
      if (off) return;
      let btc: number | null = null;
      let fund: Live["fund"] = null;
      for (const m of mk ?? []) {
        const s = m.marketStats;
        const mark = parseFloat(s.markPrice);
        if (m.symbol === "BTC-USD" && mark > 0) btc = mark;
        const liquid = parseFloat(s.volume24h) >= 50_000 && parseFloat(s.openInterest) >= 25_000;
        const apr = parseFloat(s.fundingRate) * 8760 * 100; // hourly rate -> APR %
        if (liquid && Number.isFinite(apr) && (!fund || Math.abs(apr) > Math.abs(fund.apr))) fund = { name: m.assetName || m.symbol, apr };
      }
      setD({
        btc,
        fund,
        traders: sum ? sum.total_users : null,
        volume: sum ? Number(sum.total_volume_usd) : null,
      });
    });
    return () => {
      off = true;
    };
  }, []);

  if (!d) return null;

  const chip = "rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-left shadow-xl backdrop-blur";
  return (
    <>
      {d.btc && (
        <div className={`${chip} float absolute -left-3 top-10 hidden w-48 lg:block`} style={{ animationDelay: "0s" }}>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-up" /> BTC-USD mark
          </div>
          <div className="num mt-1 text-xl font-bold text-ink">${price(d.btc)}</div>
        </div>
      )}
      {d.fund && (
        <div className={`${chip} float absolute -right-3 top-24 hidden w-52 lg:block`} style={{ animationDelay: "1.2s" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Highest liquid funding</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-ink">{d.fund.name}</span>
            <span className={`num text-sm font-bold ${d.fund.apr >= 0 ? "text-down" : "text-up"}`}>
              {d.fund.apr >= 0 ? "+" : ""}
              {d.fund.apr.toFixed(0)}% APR
            </span>
          </div>
        </div>
      )}
      {d.traders && (
        <div className={`${chip} float absolute -bottom-6 left-16 hidden w-72 lg:block`} style={{ animationDelay: "2.1s" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Strike so far</div>
          <div className="num mt-1 whitespace-nowrap text-sm font-bold text-ink">
            {d.traders.toLocaleString()} traders{d.volume ? ` · $${fmt(d.volume)} volume` : ""}
          </div>
        </div>
      )}
    </>
  );
}
