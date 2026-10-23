/** Account + position reads (API-wallet auth). Numbers arrive as strings. */
import { authedFetch } from "./http";

export interface Account {
  account_id: string;
  blockchain?: string;
  blockchain_address?: string | null;
  wallet_balance: string;
  available_balance: string;
  unrealized_pnl: string;
  margin_balance: string;
  default_leverage?: number;
  symbol_settings?: Record<string, { margin_mode: string; leverage: number }>;
}

export interface Position {
  id: number;
  symbol: string;
  /** signed: >0 long, <0 short */
  size: string;
  entry_price: string;
  leverage: number;
  margin_mode: string;
  upnl: string;
  liquidation_price?: string;
}

export const getAccount = () => authedFetch<Account>("GET", "/v2/account");

export async function getPositions(symbol?: string): Promise<Position[]> {
  const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  const r = await authedFetch<{ positions?: Position[] }>("GET", `/v2/positions${q}`);
  return r.positions ?? [];
}

export async function getOpenOrders(symbol?: string): Promise<unknown[]> {
  const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  const r = await authedFetch<{ orders?: unknown[] }>("GET", `/v2/openOrders${q}`);
  return r.orders ?? [];
}
