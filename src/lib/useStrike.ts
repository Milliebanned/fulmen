"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCopyTraders,
  fetchFearGreed,
  fetchLeaderboard,
  fetchLiquidations,
  fetchMarkets,
  fetchPremium,
  fetchSparklines,
  fetchSummary,
  STRIKE_WS,
  type LeaderEntry,
  type PlatformSummary,
} from "./strike";
import { buildIdeas, buildMarkets, buildSmartMoney, type Idea, type Market, type SmartMoney } from "./signals";

export interface Snapshot {
  markets: Market[];
  ideas: Idea[];
  smart: SmartMoney;
  fearGreed: { value: number; classification: string } | null;
  summary: PlatformSummary | null;
  leaders: LeaderEntry[];
  updatedAt: number;
}

const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

export function useSnapshot(refreshMs = 20_000) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [raw, prem, sparks] = await Promise.all([fetchMarkets(), fetchPremium(), fetchSparklines()]);
      const [fg, copy, summary, board, liq] = await Promise.all([
        settle(fetchFearGreed(), null),
        settle(fetchCopyTraders(200), { items: [], total: 0 }),
        settle(fetchSummary(), null),
        settle(fetchLeaderboard("7d", 8), { entries: [], total: 0 }),
        settle(fetchLiquidations(), [] as [number, string, number | string][]),
      ]);
      const markets = buildMarkets(raw, prem, sparks);
      const smart = buildSmartMoney(copy.items);
      const cutoff = Date.now() - 7 * 86_400_000;
      const liq7: Record<string, number> = {};
      for (const [ts, sym, v] of liq) if (ts >= cutoff) liq7[sym] = (liq7[sym] ?? 0) + Number(v);
      const ideas = buildIdeas(markets, smart, liq7, fg?.value ?? 50);
      setSnap({ markets, ideas, smart, fearGreed: fg, summary, leaders: board.entries, updatedAt: Date.now() });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Strike data");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { snap, error, reload: load };
}

/** Live mark prices from Strike's public WebSocket (all markets, every ~3s). */
export function useLiveMarks() {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      const ws = new WebSocket(STRIKE_WS);
      wsRef.current = ws;
      ws.onopen = () => {
        setLive(true);
        ws.send(JSON.stringify({ method: "subscribe", channel: "!markprice@arr", id: 1 }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          const arr = Array.isArray(msg) ? msg : msg.data && Array.isArray(msg.data) ? msg.data : msg.s ? [msg] : null;
          if (!arr) return;
          const upd: Record<string, number> = {};
          for (const m of arr) if (m?.s && m?.p) upd[m.s] = parseFloat(m.p);
          if (Object.keys(upd).length) setMarks((prev) => ({ ...prev, ...upd }));
        } catch {}
      };
      ws.onclose = () => {
        setLive(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  return { marks, live };
}
