/**
 * Injected-wallet detection / connection / message signing for Strike builder connect.
 *   cardano:  CIP-30 signData over hex(utf8 message) -> "{coseSign1Hex}:{coseKeyHex}";
 *             backend needs a BECH32 address (addr1... / addr_test1...)
 *   ethereum: EIP-191 personal_sign -> 0x hex
 *   solana:   Ed25519 over utf8 bytes -> base58 signature
 * Browser-only: call from event handlers / effects, never during SSR.
 */
import { IS_TESTNET } from "./config";
import type { Chain } from "./keys";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export interface WalletInfo {
  id: string;
  name: string;
  chain: Chain;
  icon?: string;
}

export interface ConnectedWallet {
  chain: Chain;
  walletId: string;
  /** Address in the form the Strike backend expects (bech32 for Cardano). */
  address: string;
  /** Cardano only: raw hex address for signData. */
  addressHex?: string;
  api: Any;
}

const CARDANO_IDS = ["eternl", "lace", "nami", "gerowallet", "vespr", "yoroi", "typhoncip30", "flint", "nufi", "begin", "ctrl", "okxwallet"];

export function detectWallets(): WalletInfo[] {
  if (typeof window === "undefined") return [];
  const w = window as Any;
  const out: WalletInfo[] = [];
  for (const id of CARDANO_IDS) {
    const ns = w.cardano?.[id];
    if (ns?.enable) out.push({ id, name: ns.name || id, chain: "cardano", icon: ns.icon });
  }
  if (w.phantom?.solana || w.solana?.isPhantom) out.push({ id: "phantom", name: "Phantom (Solana)", chain: "solana" });
  if (w.solflare) out.push({ id: "solflare", name: "Solflare", chain: "solana" });
  const eth = w.ethereum;
  if (eth) {
    const providers: Any[] = eth.providers || [eth];
    const seen = new Set<string>();
    const add = (id: string, name: string) => {
      if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, name, chain: "ethereum" });
      }
    };
    for (const p of providers) {
      if (p.isRabby) add("rabby", "Rabby");
      else if (p.isCoinbaseWallet) add("coinbase", "Coinbase Wallet");
      else if (p.isBraveWallet) add("brave", "Brave Wallet");
      else if (p.isMetaMask) add("metamask", "MetaMask");
    }
    if (w.phantom?.ethereum) add("phantom-evm", "Phantom (EVM)");
    if (seen.size === 0) add("injected", "Browser wallet (EVM)");
  }
  return out;
}

/* ---------------- connect ---------------- */

export async function connectWallet(chain: Chain, walletId: string): Promise<ConnectedWallet> {
  const w = window as Any;
  if (chain === "cardano") {
    const ns = w.cardano?.[walletId];
    if (!ns?.enable) throw new Error(`${walletId} wallet not found`);
    const api = await ns.enable();
    const addressHex: string = await api.getChangeAddress();
    const networkId: number = await api.getNetworkId();
    if (IS_TESTNET && networkId !== 0) throw new Error("Switch your Cardano wallet to the Preprod/Testnet network");
    if (!IS_TESTNET && networkId !== 1) throw new Error("Switch your Cardano wallet to Mainnet");
    return { chain, walletId, address: cardanoHexToBech32(addressHex, networkId), addressHex, api };
  }
  if (chain === "solana") {
    const provider: Any = walletId === "solflare" ? w.solflare : (w.phantom?.solana ?? w.solana);
    if (!provider) throw new Error(`${walletId} wallet not found`);
    const resp = await provider.connect();
    const pk = resp?.publicKey ?? provider.publicKey;
    if (!pk) throw new Error("Solana wallet returned no public key");
    return { chain, walletId, address: pk.toString(), api: provider };
  }
  const eth = w.ethereum;
  if (!eth) throw new Error("No Ethereum provider found");
  const providers: Any[] = eth.providers || [eth];
  const provider: Any =
    walletId === "rabby" ? providers.find((p) => p.isRabby) || eth
    : walletId === "coinbase" ? providers.find((p) => p.isCoinbaseWallet) || eth
    : walletId === "brave" ? providers.find((p) => p.isBraveWallet) || eth
    : walletId === "phantom-evm" ? w.phantom?.ethereum || eth
    : walletId === "metamask" ? providers.find((p) => p.isMetaMask && !p.isRabby && !p.isBraveWallet && !p.isCoinbaseWallet) || eth
    : eth;
  const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("Wallet returned no accounts");
  return { chain, walletId, address: accounts[0], api: provider };
}

/* ---------------- sign `message_to_sign` ---------------- */

export async function signChallenge(wallet: ConnectedWallet, message: string): Promise<string> {
  if (wallet.chain === "cardano") {
    if (!wallet.api.signData) throw new Error("Wallet does not support CIP-30 signData");
    const { signature, key } = await wallet.api.signData(wallet.addressHex, utf8ToHex(message));
    return `${signature}:${key}`;
  }
  if (wallet.chain === "solana") {
    if (!wallet.api.signMessage) throw new Error("Wallet does not support signMessage");
    const r = await wallet.api.signMessage(new TextEncoder().encode(message), "utf8");
    const bytes: Uint8Array | null =
      r instanceof Uint8Array ? r
      : r?.signature instanceof Uint8Array ? r.signature
      : r?.signature ? Uint8Array.from(Object.values(r.signature) as number[])
      : null;
    if (!bytes) throw new Error("Unexpected signMessage result from wallet");
    return base58Encode(bytes);
  }
  const sig: string = await wallet.api.request({
    method: "personal_sign",
    params: ["0x" + utf8ToHex(message), wallet.address],
  });
  return sig;
}

/* ---------------- helpers (exported for tests) ---------------- */

export function utf8ToHex(s: string): string {
  let h = "";
  for (const b of new TextEncoder().encode(s)) h += b.toString(16).padStart(2, "0");
  return h;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const [Z, EIGHT, B] = [BigInt(0), BigInt(8), BigInt(58)];
  let n = Z;
  for (const b of bytes) n = (n << EIGHT) | BigInt(b);
  let s = "";
  while (n > Z) {
    s = B58[Number(n % B)] + s;
    n /= B;
  }
  return "1".repeat(zeros) + s;
}

const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function polymod(values: number[]): number {
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= G[i];
  }
  return chk >>> 0;
}
export function bech32Encode(hrp: string, data: Uint8Array): string {
  const words: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const v of data) {
    acc = (acc << 8) | v;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) words.push((acc << (5 - bits)) & 31);
  const exp = [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
  const mod = polymod([...exp, ...words, 0, 0, 0, 0, 0, 0]) ^ 1; // bech32 (not m)
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
  return hrp + "1" + [...words, ...checksum].map((w) => BECH32[w]).join("");
}
export function cardanoHexToBech32(hex: string, networkId: number): string {
  const clean = hex.replace(/^0x/i, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bech32Encode(networkId === 1 ? "addr" : "addr_test", bytes);
}
