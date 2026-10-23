/**
 * Client-side Ed25519 API-wallet keys (WebCrypto Ed25519; no dependencies).
 * Needs Chrome 137+/Edge 137+, Firefox 129+, Safari 17+, Node 20+/24.
 *
 * SECURITY TRADEOFF (read before changing): the API-wallet private key (32-byte seed,
 * hex) is kept in memory AND persisted to localStorage so a page reload does not force
 * the user to re-sign a wallet challenge. Any XSS on this origin could read it. Impact
 * is bounded: an API wallet can trade and cancel but CANNOT withdraw or deposit (docs),
 * it expires, and the user can revoke it by reconnecting (which revokes prior wallets).
 * Do not log keys. "Disconnect" wipes both copies.
 */
import { API_BASE_URL, BUILDER_CODE, STRIKE_ENV } from "./config";

export interface KeyPair {
  /** 64 hex chars (32 bytes), raw Ed25519 public key. */
  publicKey: string;
  /** 64 hex chars (32 bytes), Ed25519 seed. */
  privateKey: string;
}

export type Chain = "ethereum" | "solana" | "cardano";

export interface Session {
  accountId: string;
  address: string;
  chain: Chain;
  builderCode: string;
  feeShareBps: number;
  publicKey: string;
  privateKey: string;
  apiWalletExpiresAt?: string;
  createdAt: number;
}

const PKCS8_PREFIX = "302e020100300506032b657004220420"; // Ed25519 PKCS#8 header + 32B seed

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error("invalid hex");
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export async function isEd25519Supported(): Promise<boolean> {
  try {
    await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    return true;
  } catch {
    return false;
  }
}

export async function generateKeyPair(): Promise<KeyPair> {
  let kp: CryptoKeyPair;
  try {
    kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  } catch {
    throw new Error(
      "This browser does not support Ed25519 in WebCrypto. Use a recent Chrome/Edge (137+), Firefox (129+) or Safari (17+).",
    );
  }
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  return { privateKey: bytesToHex(pkcs8.slice(pkcs8.length - 32)), publicKey: bytesToHex(raw) };
}

const keyCache = new Map<string, CryptoKey>();
async function importPrivate(seedHex: string): Promise<CryptoKey> {
  const hit = keyCache.get(seedHex);
  if (hit) return hit;
  if (seedHex.length !== 64) throw new Error("private key must be a 32-byte hex seed");
  const k = await crypto.subtle.importKey("pkcs8", hexToBytes(PKCS8_PREFIX + seedHex), { name: "Ed25519" }, false, ["sign"]);
  keyCache.set(seedHex, k);
  return k;
}

/** Ed25519 signature (128 hex chars) of `data` with the hex seed. */
export async function signHex(seedHex: string, data: Uint8Array): Promise<string> {
  const key = await importPrivate(seedHex);
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, key, data as Uint8Array<ArrayBuffer>);
  return bytesToHex(new Uint8Array(sig));
}

export async function verifyHex(publicKeyHex: string, signatureHex: string, data: Uint8Array): Promise<boolean> {
  const pub = await crypto.subtle.importKey("raw", hexToBytes(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, pub, hexToBytes(signatureHex), data as Uint8Array<ArrayBuffer>);
}

/* ---------------- session persistence ---------------- */

const storageKey = () => `fulmen.live.session.v1:${STRIKE_ENV}:${API_BASE_URL}:${BUILDER_CODE ?? "-"}`;
let memory: Session | null = null;

export function saveSession(s: Session): void {
  memory = s;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(s));
  } catch {
    /* private mode / blocked: memory only */
  }
}

export function loadSession(): Session | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.privateKey || !s?.publicKey || !s?.accountId) return null;
    if (s.apiWalletExpiresAt && Date.parse(s.apiWalletExpiresAt) < Date.now()) {
      clearSession();
      return null;
    }
    memory = s;
    return s;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  memory = null;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}
