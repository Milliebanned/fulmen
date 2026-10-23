// Thin client for Strike Finance's public API (no auth, CORS open).
// Docs: https://docs.strikefinance.org

export const STRIKE_API = "https://api.strikefinance.org";
export const STRIKE_WS = "wss://api.strikefinance.org/ws/price";
export const STRIKE_APP = "https://app.strikefinance.org";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${STRIKE_API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Strike ${path} -> HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface RawMarket {
  symbol: string;
  assetName: string;
  category: string;
  active: boolean;
  visibleOnUI: boolean;
  marketStats: {
    volume24h: string;
    priceChangePercentage24h: string;
    low24h: string;
    high24h: string;
    lastPrice: string;
    markPrice: string;
    indexPrice: string;
    fundingRate: string;
    openInterest: string;
  };
}

export interface RawPremium {
  symbol: string;
  markPrice: string;
  fundingRate: string; // HOURLY rate (verified against docs formula)
  nextFundingTime: number;
}

export interface CopyTrader {
  address: string;
  account_value: string;
  copy_score: string | null;
  pnl: Record<string, string>;
  roi: Record<string, string>;
  top_assets: { asset: string; symbol: string }[] | null;
  recommended_direction: string | null;
  last_traded_at_ms: number | null;
  equity_curve_30d?: [number, string][];
}

export interface LeaderEntry {
  rank: number;
  account_id: string;
  nickname: string;
  ada_handle: string;
  blockchain_address: string;
  total_pnl: string;
  roi: string;
  volume: string;
  total_trades: number;
  win_rate_pct: string | null;
  sharpe_ratio: string | null;
  max_drawdown_pct: string | null;
}

export interface PlatformSummary {
  total_users: number;
  total_volume_usd: string;
  total_liquidated_usd: string;
  total_revenue_usd: string;
}

export const fetchMarkets = () =>
  get<{ data: RawMarket[] }>("/price/v2/marketStats").then((r) => r.data);

export const fetchPremium = () => get<RawPremium[]>("/price/v2/premiumIndex");

export const fetchSparklines = () =>
  get<{ data: Record<string, { closes: string[] }> }>(
    "/price/v2/sparklines?interval=1h&points=24&priceType=last",
  ).then((r) => r.data);

export const fetchFearGreed = () =>
  get<{ data: { value: number; classification: string } }>("/price/v2/fearGreed").then((r) => r.data);

export const fetchCopyTraders = (limit = 200) =>
  get<{ items: CopyTrader[]; total: number }>(
    `/v2/copy/discover?platform=strike&limit=${limit}&rank_by=pnl_30d`,
  );

export const fetchLeaderboard = (range: "24h" | "7d" | "30d" = "7d", limit = 10) =>
  get<{ entries: LeaderEntry[]; total: number }>(
    `/stat/v1/stats/leaderboard?time_range=${range}&limit=${limit}&sort_by=total_pnl`,
  );

export const fetchSummary = () => get<PlatformSummary>("/stat/v1/dashboard/summary");

export const fetchLiquidations = () =>
  get<{ daily_liquidations: [number, string, number | string][] }>("/stat/v1/dashboard/liquidations").then(
    (r) => r.daily_liquidations,
  );
