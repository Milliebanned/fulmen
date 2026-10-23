"use client";

// App-wide state, mounted once in the root layout so navigating between pages is instant and keeps
// the live data, WebSocket prices and the paper account alive.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { price, size, type Idea, type Sizing } from "./signals";
import { useLiveMarks, useSnapshot, type Snapshot } from "./useStrike";
import * as paper from "./paper";

export interface Analyst {
  symbol: string;
  text: string;
  source: string;
}

export interface App {
  snap: Snapshot | null;
  error: string | null;
  marks: Record<string, number>;
  liveMarks: Record<string, number>;
  live: boolean;
  /** Live mark if the WebSocket has one, otherwise the fallback. */
  mark: (symbol: string, fallback: number) => number;

  selected: string | null;
  select: (symbol: string) => void;
  idea: Idea | undefined;
  sizing: Sizing | null;
  /** Stop/target anchored on the same live mark the chart, ticket and paper fill use. */
  lv: { m: number; stop: number; target: number } | null;
  riskPct: number;
  setRiskPct: (v: number) => void;

  ai: Analyst | null;
  aiLoading: boolean;

  paper: paper.PaperState;
  equity: number;
  pnl: number;
  openTrade: () => void;
  closePosition: (id: string) => void;
  resetPaper: () => void;

  toast: string | null;
}

const Ctx = createContext<App | null>(null);

export function useApp(): App {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { snap, error } = useSnapshot();
  const { marks, live } = useLiveMarks();
  const [selected, setSelected] = useState<string | null>(null);
  const [riskPct, setRiskPct] = useState(0.01);
  const [state, setState] = useState<paper.PaperState>(paper.emptyState());
  const [hydrated, setHydrated] = useState(false);
  const [ai, setAi] = useState<Analyst | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(paper.loadState());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) paper.saveState(state);
  }, [state, hydrated]);

  const mark = (sym: string, fallback: number) => marks[sym] ?? fallback;

  // stops / targets / funding accrual
  const rates = useMemo(
    () => Object.fromEntries((snap?.markets ?? []).map((m) => [m.symbol, m.fundingHourly])),
    [snap],
  );
  useEffect(() => {
    if (!hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.positions.length ? paper.tick(s, marks, rates) : s));
  }, [marks, rates, hydrated]);

  const idea: Idea | undefined = useMemo(() => {
    if (!snap) return undefined;
    return snap.ideas.find((i) => i.market.symbol === selected) ?? snap.ideas[0];
  }, [snap, selected]);

  // AI rationale for the selected idea
  useEffect(() => {
    if (!idea) return;
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAiLoading(true);
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: idea.market.symbol,
        side: idea.side,
        conviction: idea.conviction,
        entry: idea.entry,
        stop: idea.stop,
        target: idea.target,
        fearGreed: snap?.fearGreed?.value,
        reasons: idea.reasons,
      }),
    })
      .then((r) => r.json())
      .then((j) => !cancel && setAi({ symbol: idea.market.symbol, text: j.text, source: j.source }))
      .catch(() => !cancel && setAi(null))
      .finally(() => !cancel && setAiLoading(false));
    return () => {
      cancel = true;
    };
    // re-explain only when the idea identity or side changes, not on every price tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.market.symbol, idea?.side]);

  const liveMarks = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of snap?.markets ?? []) out[m.symbol] = marks[m.symbol] ?? m.mark;
    return out;
  }, [snap, marks]);

  const equity = paper.equity(state, liveMarks);
  const pnl = equity - state.start;
  const sizing = idea ? size(idea, equity, riskPct) : null;
  const lv = idea
    ? (() => {
        const m = mark(idea.market.symbol, idea.entry);
        const dir = idea.side === "long" ? 1 : -1;
        return { m, stop: m * (1 - dir * idea.stopPct), target: m * (1 + dir * idea.stopPct * 2) };
      })()
    : null;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openTrade = () => {
    if (!idea || !sizing || !lv || !(lv.m > 0)) return;
    setState((s) =>
      paper.open(s, { symbol: idea.market.symbol, side: idea.side, entry: lv.m, notional: sizing.notional, stop: lv.stop, target: lv.target }),
    );
    flash(`Paper ${idea.side} ${idea.market.symbol} opened at ${price(lv.m)}`);
  };

  const closePosition = (id: string) => {
    setState((s) => {
      const p = s.positions.find((x) => x.id === id);
      return p ? paper.close(s, id, liveMarks[p.symbol] ?? p.entry) : s;
    });
  };

  const value: App = {
    snap,
    error,
    marks,
    liveMarks,
    live,
    mark,
    selected,
    select: setSelected,
    idea,
    sizing,
    lv,
    riskPct,
    setRiskPct,
    ai,
    aiLoading,
    paper: state,
    equity,
    pnl,
    openTrade,
    closePosition,
    resetPaper: () => setState(paper.emptyState()),
    toast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
