import type { Side } from "./signals";

// Paper broker: simulated fills at the live Strike mark price. State lives in localStorage.
// Funding is accrued hourly using Strike's real convention (positive rate: longs pay shorts).

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  entry: number;
  qty: number;
  notional: number;
  stop: number;
  target: number;
  openedAt: number;
  lastFundingAt: number;
  fundingPaid: number; // negative = paid, positive = received
}

export interface Closed extends Position {
  exit: number;
  closedAt: number;
  pnl: number;
  reason: "manual" | "stop" | "target";
}

export interface PaperState {
  cash: number;
  start: number;
  positions: Position[];
  history: Closed[];
}

export const START_EQUITY = 10_000;
const KEY = "fulmen.paper.v1";

export const emptyState = (): PaperState => ({
  cash: START_EQUITY,
  start: START_EQUITY,
  positions: [],
  history: [],
});

export function loadState(): PaperState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch {}
  return emptyState();
}

export function saveState(s: PaperState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

const dirOf = (s: Side) => (s === "long" ? 1 : -1);

export function unrealized(p: Position, mark: number) {
  return dirOf(p.side) * (mark - p.entry) * p.qty;
}

export function equity(s: PaperState, marks: Record<string, number>) {
  return (
    s.cash +
    s.positions.reduce((a, p) => a + unrealized(p, marks[p.symbol] ?? p.entry) + p.fundingPaid, 0)
  );
}

export function open(
  s: PaperState,
  o: { symbol: string; side: Side; entry: number; notional: number; stop: number; target: number },
): PaperState {
  const now = Date.now();
  const p: Position = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    symbol: o.symbol,
    side: o.side,
    entry: o.entry,
    qty: o.notional / o.entry,
    notional: o.notional,
    stop: o.stop,
    target: o.target,
    openedAt: now,
    lastFundingAt: now,
    fundingPaid: 0,
  };
  return { ...s, positions: [p, ...s.positions] };
}

function closeOne(p: Position, exit: number, reason: Closed["reason"]): Closed {
  const pnl = unrealized(p, exit) + p.fundingPaid;
  return { ...p, exit, closedAt: Date.now(), pnl, reason };
}

export function close(s: PaperState, id: string, mark: number, reason: Closed["reason"] = "manual"): PaperState {
  const p = s.positions.find((x) => x.id === id);
  if (!p) return s;
  const c = closeOne(p, mark, reason);
  return {
    ...s,
    cash: s.cash + c.pnl,
    positions: s.positions.filter((x) => x.id !== id),
    history: [c, ...s.history].slice(0, 50),
  };
}

/** Apply stops/targets and accrue funding for the elapsed time. Returns same ref if nothing changed. */
export function tick(
  s: PaperState,
  marks: Record<string, number>,
  hourlyRates: Record<string, number>,
  now = Date.now(),
): PaperState {
  let next = s;
  let changed = false;
  for (const p of s.positions) {
    const mark = marks[p.symbol];
    if (!mark) continue;
    const rate = hourlyRates[p.symbol] ?? 0;
    const hours = (now - p.lastFundingAt) / 3_600_000;
    if (hours > 0.001 && rate) {
      // long pays when rate > 0
      const pay = -dirOf(p.side) * p.qty * mark * rate * hours;
      p.fundingPaid += pay;
      p.lastFundingAt = now;
      changed = true;
    }
    const hitStop = p.side === "long" ? mark <= p.stop : mark >= p.stop;
    const hitTarget = p.side === "long" ? mark >= p.target : mark <= p.target;
    if (hitStop || hitTarget) {
      next = close(next, p.id, mark, hitStop ? "stop" : "target");
      changed = true;
    }
  }
  return changed ? { ...next, positions: [...next.positions] } : s;
}
