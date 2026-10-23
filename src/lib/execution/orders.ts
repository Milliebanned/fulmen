/**
 * Flumen Idea+Sizing -> real Strike orders.
 *
 * Endpoints (docs/openapi trade-api.yaml):
 *   POST   /v2/leverage        {symbol, leverage}                     (async-sequenced)
 *   POST   /v2/order/strategy  primary + reduce-only TP/SL legs      (X-Builder-Fee-Bps honoured)
 *   DELETE /v2/order/cancel    {symbol, order_id | client_order_id}  (JSON body is signed)
 * Side/type are lowercase ("buy"/"sell", "market"/"limit"). Sizes/prices are decimal STRINGS.
 * 2xx means "sequenced" (status "pending"), NOT filled; rejects arrive asynchronously.
 *
 * Why a bracket (strategy) order: the stop and 2R target become reduce-only conditional orders
 * that only activate once the entry fills, and are OCO. The idea's stop is therefore live on
 * the exchange, not just a UI promise.
 *
 * Price rebasing: Flumen ideas are built from MAINNET market data, but testnet marks differ.
 * The plan keeps the idea's *percentage* stop/target distances and re-anchors them on the
 * target environment's current mark, and sizes the quantity from notional / that mark.
 */
import { GUARD, type Idea, type Sizing } from "../signals";
import { getAccount, type Account } from "./account";
import { API_BASE_URL, BUILDER_FEE_BPS } from "./config";
import { authedFetch, parseError } from "./http";
import { loadSession } from "./keys";

export type OrderType = "market" | "limit";

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

export interface MarketRules {
  symbol: string;
  status: string;
  mark: number;
  tick: string;
  marketStep: string;
  marketMin: number;
  limitStep: string;
  limitMin: number;
  minNotional: number;
  maxLeverage: number;
}

export interface OrderPlan {
  symbol: string;
  side: "buy" | "sell";
  type: OrderType;
  size: string;
  price?: string;
  stopPrice: string;
  targetPrice: string;
  notional: number;
  leverage: number;
  riskUsd: number;
  equity: number;
  mark: number;
  resized: boolean;
  notes: string[];
}

/* ---------------- number helpers ---------------- */

export function decimalsOf(step: string): number {
  const n = Number(step);
  if (!Number.isFinite(n) || n <= 0) return 8;
  const s = n.toFixed(12).replace(/0+$/, "");
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}
export function floorToStep(x: number, step: string): string {
  const st = Number(step) || 1;
  return (Math.floor(x / st + 1e-9) * st).toFixed(decimalsOf(step));
}
export function roundToStep(x: number, step: string): string {
  const st = Number(step) || 1;
  return (Math.round(x / st) * st).toFixed(decimalsOf(step));
}

/* ---------------- market rules (public) ---------------- */

interface RawRules {
  symbol: string;
  status: string;
  mark_price: string;
  order_tick_price: string;
  order_market_step_size: string;
  order_market_min_size: string;
  order_limit_step_size: string;
  order_limit_min_size: string;
  order_min_notional: string;
  margin_tiers?: { max_leverage: number }[];
}

export async function fetchMarketRules(symbol: string): Promise<MarketRules> {
  const res = await fetch(`${API_BASE_URL}/v2/markets`);
  if (!res.ok) throw await parseError(res, "Could not load markets");
  const j = (await res.json()) as { markets?: Record<string, RawRules> };
  const m = j.markets?.[symbol];
  if (!m) throw new GuardError(`${symbol} is not listed on this Strike environment`);
  return {
    symbol,
    status: m.status,
    mark: Number(m.mark_price),
    tick: m.order_tick_price,
    marketStep: m.order_market_step_size,
    marketMin: Number(m.order_market_min_size),
    limitStep: m.order_limit_step_size,
    limitMin: Number(m.order_limit_min_size),
    minNotional: Number(m.order_min_notional) || 0,
    maxLeverage: m.margin_tiers?.[0]?.max_leverage ?? 1,
  };
}

/* ---------------- plan (pure; all guards live here) ---------------- */

export function buildPlan(args: {
  idea: Idea;
  sizing: Sizing;
  /** Live account equity in USD (wallet balance). */
  equity: number;
  available: number;
  rules: MarketRules;
  type: OrderType;
}): OrderPlan {
  const { idea, sizing, equity, available, rules, type } = args;
  const notes: string[] = [];
  const stopPct = idea.stopPct;
  if (!(stopPct > 0 && stopPct < 0.5)) throw new GuardError("Idea has an invalid stop distance");
  if (!(equity > 0)) throw new GuardError("Account has no equity: deposit testnet funds first");
  if (rules.status !== "trading") throw new GuardError(`${rules.symbol} is not currently trading (${rules.status})`);
  if (!(rules.mark > 0)) throw new GuardError("No valid mark price for the market");
  if (!(idea.entry > 0 && idea.market.mark > 0)) throw new GuardError("Idea has no valid entry");

  const long = idea.side === "long";
  const targetPct = Math.abs(idea.target - idea.entry) / idea.entry;
  if (!(targetPct > 0)) throw new GuardError("Idea has an invalid target");

  const priceStep = rules.tick;
  const entryRef =
    type === "limit" ? Number(roundToStep(rules.mark * (idea.entry / idea.market.mark), priceStep)) : rules.mark;
  const stop = Number(roundToStep(entryRef * (long ? 1 - stopPct : 1 + stopPct), priceStep));
  const target = Number(roundToStep(entryRef * (long ? 1 + targetPct : 1 - targetPct), priceStep));
  if (long ? !(stop < rules.mark && target > rules.mark) : !(stop > rules.mark && target < rules.mark))
    throw new GuardError("Stop/target would sit on the wrong side of the current mark price");

  // Guard (re-applied against LIVE equity, which may differ from the paper equity used for sizing).
  const riskCap = (GUARD.maxRiskPct * equity) / stopPct;
  const levCap = GUARD.maxLeverage * equity;
  let notional = Math.min(sizing.notional, riskCap, levCap);
  const resized = notional < sizing.notional - 1e-9;
  if (resized)
    notes.push(`Resized from $${sizing.notional.toFixed(2)} to $${notional.toFixed(2)} to respect risk ${GUARD.maxRiskPct * 100}% / ${GUARD.maxLeverage}x on live equity`);

  const step = type === "limit" ? rules.limitStep : rules.marketStep;
  const min = type === "limit" ? rules.limitMin : rules.marketMin;
  const size = floorToStep(notional / entryRef, step);
  if (!(Number(size) >= min)) throw new GuardError(`Size ${size} is below the market minimum ${min} ${rules.symbol.split("-")[0]}`);
  notional = Number(size) * entryRef;
  if (notional < rules.minNotional) throw new GuardError(`Notional $${notional.toFixed(2)} is below the market minimum $${rules.minNotional}`);

  const leverage = Math.max(1, Math.min(Math.ceil(notional / equity - 1e-9), GUARD.maxLeverage, rules.maxLeverage));
  const margin = notional / leverage;
  if (margin > available) throw new GuardError(`Insufficient available balance: need ~$${margin.toFixed(2)} margin, have $${available.toFixed(2)}`);

  const riskUsd = notional * stopPct;
  // Final hard assertions (defence in depth).
  if (notional / equity > GUARD.maxLeverage + 1e-6) throw new GuardError("Guard: leverage cap exceeded");
  if (riskUsd / equity > GUARD.maxRiskPct + 1e-6) throw new GuardError("Guard: risk-per-trade cap exceeded");
  if (leverage > GUARD.maxLeverage) throw new GuardError("Guard: leverage setting exceeds cap");

  return {
    symbol: rules.symbol,
    side: long ? "buy" : "sell",
    type,
    size,
    price: type === "limit" ? entryRef.toFixed(decimalsOf(priceStep)) : undefined,
    stopPrice: stop.toFixed(decimalsOf(priceStep)),
    targetPrice: target.toFixed(decimalsOf(priceStep)),
    notional,
    leverage,
    riskUsd,
    equity,
    mark: rules.mark,
    resized,
    notes,
  };
}

/** Network read-only: account + market rules -> plan. Used for the confirm screen. */
export async function preparePlan(idea: Idea, sizing: Sizing, type: OrderType): Promise<{ plan: OrderPlan; account: Account }> {
  const [account, rules] = await Promise.all([getAccount(), fetchMarketRules(idea.market.symbol)]);
  const plan = buildPlan({
    idea,
    sizing,
    equity: Number(account.wallet_balance),
    available: Number(account.available_balance),
    rules,
    type,
  });
  return { plan, account };
}

/* ---------------- request bodies ---------------- */

export function strategyBody(plan: OrderPlan, strategyId: string) {
  // TP/SL legs automatically take the opposite side and are forced reduce-only by the server.
  return {
    strategy_id: strategyId,
    symbol: plan.symbol,
    side: plan.side,
    type: plan.type,
    size: plan.size,
    ...(plan.type === "limit" ? { price: plan.price, time_in_force: "GTC" } : {}),
    tp_order: { type: "take_profit", size: plan.size, stop_price: plan.targetPrice, working_type: "mark_price" },
    sl_order: { type: "stop", size: plan.size, stop_price: plan.stopPrice, working_type: "mark_price" },
  };
}

export function builderFeeHeader(sessionFeeShareBps: number): Record<string, string> | undefined {
  const bps = Math.max(0, Math.min(BUILDER_FEE_BPS, sessionFeeShareBps, 100));
  return bps > 0 ? { "X-Builder-Fee-Bps": String(Math.floor(bps)) } : undefined;
}

/* ---------------- execution ---------------- */

export interface PlaceResult {
  plan: OrderPlan;
  strategy_id: string;
  primary_client_order_id?: string;
  tp_client_order_id?: string;
  sl_client_order_id?: string;
  account_id?: string;
  status: "pending";
  builderFeeBps: number;
}

/**
 * Re-validates everything against fresh live data (guard enforced again here), sets the symbol
 * leverage, then submits the bracket order. If `expected` is given and the fresh plan differs by
 * >10% notional, aborts so the user re-confirms what they actually get.
 */
export async function placeFromIdea(idea: Idea, sizing: Sizing, type: OrderType, expected?: OrderPlan): Promise<PlaceResult> {
  const session = loadSession();
  if (!session) throw new Error("Not connected");
  const { plan } = await preparePlan(idea, sizing, type);
  if (expected && (plan.symbol !== expected.symbol || plan.side !== expected.side || plan.type !== expected.type))
    throw new GuardError("The idea changed since you confirmed. Review the new order and confirm again.");
  if (expected && Math.abs(plan.notional - expected.notional) / expected.notional > 0.1)
    throw new GuardError("Market or balance changed since confirmation. Review the updated order and confirm again.");

  await authedFetch("POST", "/v2/leverage", { symbol: plan.symbol, leverage: plan.leverage });
  const headers = builderFeeHeader(session.feeShareBps);
  const strategyId = crypto.randomUUID();
  const r = await authedFetch<Omit<PlaceResult, "plan" | "status" | "builderFeeBps"> & { strategy_id: string }>(
    "POST",
    "/v2/order/strategy",
    strategyBody(plan, strategyId),
    headers,
  );
  return { ...r, plan, status: "pending", builderFeeBps: headers ? Number(headers["X-Builder-Fee-Bps"]) : 0 };
}

export async function cancelOrder(p: { symbol: string; orderId?: number; clientOrderId?: string }) {
  if (p.orderId === undefined && !p.clientOrderId) throw new Error("order_id or client_order_id required");
  return authedFetch<{ order_id?: number; status?: string }>("DELETE", "/v2/order/cancel", {
    symbol: p.symbol,
    ...(p.clientOrderId ? { client_order_id: p.clientOrderId } : { order_id: p.orderId }),
  });
}
