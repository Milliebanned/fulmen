/**
 * Strike API-wallet request signing, exactly per
 * https://docs.strikefinance.org/api/getting-started.md
 *
 *   message   = METHOD:PATH:TIMESTAMP:NONCE:BODY_HASH
 *   METHOD    uppercase HTTP method
 *   PATH      path INCLUDING ?query (e.g. /v2/positions?symbol=BTC-USD)
 *   TIMESTAMP unix SECONDS
 *   NONCE     UUID, unique per request
 *   BODY_HASH lowercase hex SHA-256 of the exact body bytes sent ("" for no body)
 *   signature = Ed25519(message utf8) -> 128 hex chars
 *
 * X-Builder-Fee-Bps is NOT part of the signature.
 */
import { signHex } from "./keys";

const enc = new TextEncoder();

export function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export async function sha256Hex(data: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return bytesToHex(new Uint8Array(d));
}

export function buildMessage(
  method: string,
  path: string,
  timestamp: number | string,
  nonce: string,
  bodyHash: string,
): string {
  return `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${bodyHash}`;
}

export interface SignOptions {
  method: string;
  path: string;
  /** Exact serialized body (the same string you will send). "" / undefined = none. */
  body?: string;
  privateKeyHex: string;
  publicKeyHex: string;
  /** Unix seconds; defaults to now (+ serverOffsetSec). */
  timestamp?: number;
  nonce?: string;
  serverOffsetSec?: number;
}

export interface SignedRequest {
  headers: Record<string, string>;
  message: string;
  bodyHash: string;
}

export async function signRequest(o: SignOptions): Promise<SignedRequest> {
  const timestamp = o.timestamp ?? Math.floor(Date.now() / 1000) + (o.serverOffsetSec ?? 0);
  const nonce = o.nonce ?? crypto.randomUUID();
  const bodyHash = await sha256Hex(o.body ?? "");
  const message = buildMessage(o.method, o.path, timestamp, nonce, bodyHash);
  const signature = await signHex(o.privateKeyHex, enc.encode(message));
  return {
    message,
    bodyHash,
    headers: {
      "X-API-Wallet-Public-Key": o.publicKeyHex,
      "X-API-Wallet-Signature": signature,
      "X-API-Wallet-Timestamp": String(timestamp),
      "X-API-Wallet-Nonce": nonce,
    },
  };
}
