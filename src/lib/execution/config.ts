/**
 * Live-execution configuration. Everything is env-gated; with no builder code the
 * live layer is inert (LIVE_ENABLED === false) and the UI shows a disabled state.
 *
 * NOTE: Next.js only inlines NEXT_PUBLIC_* vars when referenced as literal
 * `process.env.NEXT_PUBLIC_X` expressions, so do not refactor these into a lookup.
 */

export type StrikeEnv = "testnet" | "mainnet";

const TESTNET_URL = "https://api-v2-testnet.strikefinance.org";
const MAINNET_URL = "https://api.strikefinance.org";

export function parseEnv(v: string | undefined): StrikeEnv {
  return v?.trim().toLowerCase() === "mainnet" ? "mainnet" : "testnet";
}

/** Integer bps clamped to 0..100; unset / garbage -> 5. */
export function parseFeeBps(v: string | undefined): number {
  if (v === undefined || v.trim() === "") return 5;
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.min(100, Math.max(0, Math.floor(n)));
}

export const STRIKE_ENV: StrikeEnv = parseEnv(process.env.NEXT_PUBLIC_STRIKE_ENV);
export const IS_TESTNET = STRIKE_ENV === "testnet";
export const API_BASE_URL = STRIKE_ENV === "mainnet" ? MAINNET_URL : TESTNET_URL;
export const BUILDER_CODE: string | null =
  process.env.NEXT_PUBLIC_STRIKE_BUILDER_CODE?.trim() || null;
export const BUILDER_FEE_BPS = parseFeeBps(process.env.NEXT_PUBLIC_BUILDER_FEE_BPS);
export const LIVE_ENABLED = BUILDER_CODE !== null;
