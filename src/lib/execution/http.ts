/** Authenticated fetch for API-wallet endpoints + uniform error shape. */
import { API_BASE_URL } from "./config";
import { clearSession, loadSession } from "./keys";
import { signRequest } from "./sign";

export class StrikeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StrikeApiError";
    this.status = status;
  }
}

let offsetSec: number | null = null;
/** Clock offset vs server (GET /v2/time); requests older than 3 min are rejected. */
async function serverOffset(): Promise<number> {
  if (offsetSec !== null) return offsetSec;
  try {
    const r = await fetch(`${API_BASE_URL}/v2/time`);
    const j = (await r.json()) as { serverTime?: number };
    offsetSec = j.serverTime ? Math.round(j.serverTime / 1000 - Date.now() / 1000) : 0;
  } catch {
    offsetSec = 0;
  }
  return offsetSec;
}

export async function parseError(res: Response, fallback: string): Promise<StrikeApiError> {
  let msg = "";
  try {
    const j = (await res.json()) as { error?: unknown; message?: unknown };
    msg = String(j.error ?? j.message ?? "");
  } catch {
    /* non-JSON */
  }
  return new StrikeApiError(msg || `${fallback} (HTTP ${res.status})`, res.status);
}

export async function authedFetch<T>(
  method: "GET" | "POST" | "DELETE",
  pathWithQuery: string,
  body?: object,
  extraHeaders?: Record<string, string>,
  attempt = 0,
): Promise<T> {
  const s = loadSession();
  if (!s) throw new StrikeApiError("Not connected: no API wallet session", 401);
  const bodyStr = body !== undefined ? JSON.stringify(body) : "";
  const { headers } = await signRequest({
    method,
    path: pathWithQuery,
    body: bodyStr,
    privateKeyHex: s.privateKey,
    publicKeyHex: s.publicKey,
    serverOffsetSec: await serverOffset(),
  });
  const h: Record<string, string> = { ...headers, ...extraHeaders };
  if (bodyStr) h["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE_URL}${pathWithQuery}`, { method, headers: h, body: bodyStr || undefined });
  if (!res.ok) {
    const err = await parseError(res, `${method} ${pathWithQuery.split("?")[0]} failed`);
    // "authentication failed" is also returned for a bad signature: retry once, then drop the session.
    if (res.status === 401 && err.message === "authentication failed") {
      if (attempt === 0) return authedFetch<T>(method, pathWithQuery, body, extraHeaders, 1);
      clearSession();
    }
    if (res.status === 401 && err.message === "wallet expired or revoked") clearSession();
    throw err;
  }
  return (await res.json()) as T;
}
