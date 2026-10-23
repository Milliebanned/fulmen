/**
 * Builder connect flow (public endpoints, no auth headers):
 *   1. POST /auth/builder/request-signature {address, chain, code, fee_share_bps, public_key}
 *        -> {nonce, message_to_sign}   (nonce valid 5 min)
 *   2. user signs message_to_sign in their wallet
 *   3. POST /auth/builder/verify-signature {nonce, wallet_signature}
 *        -> {account_id, builder_code, fee_share_bps, api_wallet_public_key, api_wallet_expired_at, ...}
 * Step 3 creates the Strike account if needed, approves the builder and REVOKES earlier API wallets
 * for this account+builder. Hence: only run on explicit user action.
 */
import { API_BASE_URL, BUILDER_CODE, BUILDER_FEE_BPS } from "./config";
import { parseError } from "./http";
import { generateKeyPair, saveSession, type Chain, type Session } from "./keys";
import { signChallenge, type ConnectedWallet } from "./wallet";

export interface RequestSignatureResult {
  nonce: string;
  message_to_sign: string;
  message?: string;
}

export interface VerifySignatureResult {
  account_id: string;
  builder_code: string;
  fee_share_bps: number;
  api_wallet_id: number;
  api_wallet_public_key: string;
  api_wallet_expired_at?: string;
}

export async function requestSignature(p: {
  address: string;
  chain: Chain;
  code: string;
  feeShareBps: number;
  publicKey: string;
}): Promise<RequestSignatureResult> {
  const res = await fetch(`${API_BASE_URL}/auth/builder/request-signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: p.address,
      chain: p.chain,
      code: p.code,
      fee_share_bps: p.feeShareBps,
      public_key: p.publicKey,
    }),
  });
  if (!res.ok) throw await parseError(res, "Request signature failed");
  return (await res.json()) as RequestSignatureResult;
}

export async function verifySignature(nonce: string, walletSignature: string): Promise<VerifySignatureResult> {
  const res = await fetch(`${API_BASE_URL}/auth/builder/verify-signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonce, wallet_signature: walletSignature }),
  });
  if (!res.ok) throw await parseError(res, "Verify signature failed");
  return (await res.json()) as VerifySignatureResult;
}

/** Full connect: keygen -> challenge -> wallet signature -> verify -> persist session. */
export async function connectBuilder(wallet: ConnectedWallet): Promise<Session> {
  if (!BUILDER_CODE) throw new Error("Live trading disabled: no builder code configured");
  const keys = await generateKeyPair();
  const ch = await requestSignature({
    address: wallet.address,
    chain: wallet.chain,
    code: BUILDER_CODE,
    feeShareBps: BUILDER_FEE_BPS,
    publicKey: keys.publicKey,
  });
  const sig = await signChallenge(wallet, ch.message_to_sign);
  const v = await verifySignature(ch.nonce, sig);
  if (v.api_wallet_public_key && v.api_wallet_public_key.toLowerCase() !== keys.publicKey.toLowerCase()) {
    throw new Error("Server returned a different API wallet key than the one generated");
  }
  const session: Session = {
    accountId: v.account_id,
    address: wallet.address,
    chain: wallet.chain,
    builderCode: v.builder_code,
    feeShareBps: v.fee_share_bps,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    apiWalletExpiresAt: v.api_wallet_expired_at,
    createdAt: Date.now(),
  };
  saveSession(session);
  return session;
}
