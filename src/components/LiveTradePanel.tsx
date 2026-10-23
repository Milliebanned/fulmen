"use client";

import { useCallback, useEffect, useState } from "react";
import { GUARD, type Idea, type Sizing } from "@/lib/signals";
import { getAccount, getPositions, type Account, type Position } from "@/lib/execution/account";
import { connectBuilder } from "@/lib/execution/builder";
import { BUILDER_CODE, BUILDER_FEE_BPS, LIVE_ENABLED, STRIKE_ENV } from "@/lib/execution/config";
import { clearSession, isEd25519Supported, loadSession, type Session } from "@/lib/execution/keys";
import { placeFromIdea, preparePlan, type OrderPlan, type OrderType, type PlaceResult } from "@/lib/execution/orders";
import { connectWallet, detectWallets, type WalletInfo } from "@/lib/execution/wallet";

type Phase =
  | { k: "idle" }
  | { k: "connecting"; step: string }
  | { k: "reviewing" }
  | { k: "confirm"; plan: OrderPlan }
  | { k: "sending"; plan: OrderPlan }
  | { k: "done"; result: PlaceResult }
  | { k: "error"; message: string; back: "idle" | "confirm"; plan?: OrderPlan };

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NET = STRIKE_ENV.toUpperCase();

function NetBadge() {
  const test = STRIKE_ENV === "testnet";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${
        test ? "bg-bolt/15 text-bolt" : "bg-down/15 text-down"
      }`}
    >
      {NET}
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live execution</h3>
        <NetBadge />
      </div>
      {children}
    </div>
  );
}

export function LiveTradePanel({ idea, sizing }: { idea: Idea; sizing: Sizing }) {
  if (!LIVE_ENABLED) {
    return (
      <Shell>
        <p className="text-sm text-muted">Live trading disabled: no builder code configured.</p>
        <p className="mt-1 text-xs text-muted">
          Set <code>NEXT_PUBLIC_STRIKE_BUILDER_CODE</code> to enable. Paper trading is unaffected.
        </p>
      </Shell>
    );
  }
  return <LivePanel idea={idea} sizing={sizing} />;
}

function LivePanel({ idea, sizing }: { idea: Idea; sizing: Sizing }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [edOk, setEdOk] = useState(true);
  const [type, setType] = useState<OrderType>("market");
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([getAccount(), getPositions(idea.market.symbol)]);
      setAccount(a);
      setPositions(p);
    } catch (e) {
      // session may have been dropped by the http layer (revoked/expired)
      if (!loadSession()) setSession(null);
      setPhase({ k: "error", message: errMsg(e), back: "idle" });
    }
  }, [idea.market.symbol]);

  // Wallet extensions inject after load; detect client-side only.
  useEffect(() => {
    const t = setTimeout(async () => {
      setMounted(true);
      setEdOk(await isEd25519Supported());
      setWallets(detectWallets());
      const s = loadSession();
      if (s) {
        setSession(s);
        void refresh();
      }
    }, 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const connect = async (w: WalletInfo) => {
    try {
      setPhase({ k: "connecting", step: `Opening ${w.name}...` });
      const wallet = await connectWallet(w.chain, w.id);
      setPhase({ k: "connecting", step: "Sign the Strike connect message in your wallet..." });
      const s = await connectBuilder(wallet);
      setSession(s);
      setPhase({ k: "idle" });
      await refresh();
    } catch (e) {
      setPhase({ k: "error", message: errMsg(e), back: "idle" });
    }
  };

  const disconnect = () => {
    clearSession();
    setSession(null);
    setAccount(null);
    setPositions([]);
    setPhase({ k: "idle" });
  };

  const review = async () => {
    setPhase({ k: "reviewing" });
    try {
      const { plan, account: a } = await preparePlan(idea, sizing, type);
      setAccount(a);
      setPhase({ k: "confirm", plan });
    } catch (e) {
      setPhase({ k: "error", message: errMsg(e), back: "idle" });
    }
  };

  const send = async (plan: OrderPlan) => {
    setPhase({ k: "sending", plan });
    try {
      const result = await placeFromIdea(idea, sizing, type, plan);
      setPhase({ k: "done", result });
      void refresh();
    } catch (e) {
      setPhase({ k: "error", message: errMsg(e), back: "idle", plan });
    }
  };

  /* ---------- not connected ---------- */
  if (!session) {
    return (
      <Shell>
        {phase.k === "connecting" ? (
          <p className="text-sm text-muted">{phase.step}</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Connect a wallet to trade <b className="text-ink">{idea.market.symbol}</b> on Strike {NET.toLowerCase()}. Orders
              carry builder code <code>{BUILDER_CODE}</code> ({BUILDER_FEE_BPS} bps max fee).
            </p>
            {!edOk && mounted && (
              <p className="mt-2 text-xs text-down">This browser lacks WebCrypto Ed25519. Use a recent Chrome, Edge, Firefox or Safari.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {wallets.map((w) => (
                <button
                  key={`${w.chain}-${w.id}`}
                  onClick={() => connect(w)}
                  disabled={!edOk}
                  className="rounded border border-line px-3 py-1.5 text-xs hover:border-bolt hover:text-bolt disabled:opacity-40"
                >
                  {w.name} <span className="text-muted">({w.chain})</span>
                </button>
              ))}
              {mounted && wallets.length === 0 && (
                <span className="text-xs text-muted">No wallet detected (Cardano CIP-30, Phantom, or an EVM wallet).</span>
              )}
            </div>
          </>
        )}
        {phase.k === "error" && <p className="mt-3 break-words text-xs text-down">{phase.message}</p>}
      </Shell>
    );
  }

  /* ---------- connected ---------- */
  const pos = positions[0];
  return (
    <Shell>
      <div className="mb-3 space-y-1 text-xs text-muted">
        <div className="flex justify-between gap-2">
          <span>Account</span>
          <span className="truncate font-mono text-ink" title={session.accountId}>{session.accountId}</span>
        </div>
        <div className="flex justify-between">
          <span>Balance / available</span>
          <span className="font-mono text-ink">
            {account ? `${usd(Number(account.wallet_balance))} / ${usd(Number(account.available_balance))}` : "..."}
          </span>
        </div>
        {pos && (
          <div className="flex justify-between">
            <span>Open {pos.symbol}</span>
            <span className={`font-mono ${Number(pos.upnl) >= 0 ? "text-up" : "text-down"}`}>
              {pos.size} @ {pos.entry_price} (uPnL {pos.upnl})
            </span>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={refresh} className="underline hover:text-ink">Refresh</button>
          <button onClick={disconnect} className="underline hover:text-ink">Disconnect</button>
        </div>
      </div>

      {(phase.k === "idle" || phase.k === "reviewing") && (
        <>
          <div className="mb-2 flex gap-2 text-xs">
            {(["market", "limit"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded border px-2 py-1 ${type === t ? "border-bolt text-bolt" : "border-line text-muted"}`}
              >
                {t}
              </button>
            ))}
            <span className="ml-auto text-muted">
              guard: {GUARD.maxLeverage}x / {GUARD.maxRiskPct * 100}% risk
            </span>
          </div>
          <button
            onClick={review}
            disabled={phase.k === "reviewing"}
            className="w-full rounded bg-bolt px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {phase.k === "reviewing" ? "Checking live market..." : `Review ${idea.side.toUpperCase()} ${idea.market.symbol} order`}
          </button>
        </>
      )}

      {(phase.k === "confirm" || phase.k === "sending") && (
        <div className="space-y-3">
          <p className="rounded border border-down/40 bg-down/10 p-2 text-xs">
            You are placing a <b>REAL order on {NET}</b>: <b>{phase.plan.side.toUpperCase()} {phase.plan.symbol}</b>{" "}
            {usd(phase.plan.notional)} notional ({phase.plan.size} units, {phase.plan.type}
            {phase.plan.price ? ` @ ${phase.plan.price}` : ""}), {phase.plan.leverage}x leverage, stop {phase.plan.stopPrice}, target{" "}
            {phase.plan.targetPrice}. Max risk {usd(phase.plan.riskUsd)}. Builder fee up to {Math.min(BUILDER_FEE_BPS, session.feeShareBps)} bps
            of fill notional.
          </p>
          {phase.plan.notes.map((n) => (
            <p key={n} className="text-xs text-bolt">{n}</p>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => setPhase({ k: "idle" })}
              disabled={phase.k === "sending"}
              className="flex-1 rounded border border-line px-3 py-2 text-sm disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={() => send(phase.plan)}
              disabled={phase.k === "sending"}
              className="flex-1 rounded bg-down px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {phase.k === "sending" ? "Sending..." : `Confirm real ${NET} order`}
            </button>
          </div>
        </div>
      )}

      {phase.k === "done" && (
        <div className="space-y-2 text-xs">
          <p className="text-up">
            Order accepted by Strike ({phase.result.status}). It is sequenced, not necessarily filled yet.
          </p>
          <p className="break-all font-mono text-muted">
            strategy {phase.result.strategy_id}
            {phase.result.primary_client_order_id ? ` / entry ${phase.result.primary_client_order_id}` : ""}
          </p>
          <p className="text-muted">Builder fee sent: {phase.result.builderFeeBps} bps. Stop and target are live reduce-only legs.</p>
          <button onClick={() => setPhase({ k: "idle" })} className="underline">New order</button>
        </div>
      )}

      {phase.k === "error" && (
        <div className="space-y-2 text-xs">
          <p className="break-words text-down">{phase.message}</p>
          <button onClick={() => setPhase({ k: "idle" })} className="underline">Dismiss</button>
        </div>
      )}
    </Shell>
  );
}
