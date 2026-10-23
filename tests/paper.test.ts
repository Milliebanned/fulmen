import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/lib/paper";
import { size, type Idea } from "../src/lib/signals";

test("short collects hourly funding and hits target", () => {
  let s = P.open(P.emptyState(), { symbol: "X-USD", side: "short", entry: 100, notional: 1000, stop: 105, target: 90 });
  assert.equal(s.positions[0].qty, 10);
  const t0 = s.positions[0].lastFundingAt;
  // 10h at +0.01%/h: longs pay, short receives 10 * 98 * 0.0001 * 10 = 0.98
  s = P.tick(s, { "X-USD": 98 }, { "X-USD": 0.0001 }, t0 + 10 * 3_600_000);
  assert.equal(s.positions.length, 1);
  assert.ok(Math.abs(s.positions[0].fundingPaid - 0.98) < 1e-6);
  assert.ok(Math.abs(P.equity(s, { "X-USD": 98 }) - (10_000 + 20 + 0.98)) < 1e-6);
  s = P.tick(s, { "X-USD": 89 }, { "X-USD": 0.0001 }, t0 + 10 * 3_600_000);
  assert.equal(s.positions.length, 0);
  assert.equal(s.history[0].reason, "target");
  assert.ok(s.cash > 10_100);
});

test("long is stopped out for the planned loss", () => {
  let l = P.open(P.emptyState(), { symbol: "Y-USD", side: "long", entry: 50, notional: 500, stop: 47.5, target: 55 });
  l = P.tick(l, { "Y-USD": 47 }, {}, Date.now());
  assert.equal(l.history[0].reason, "stop");
  assert.ok(l.cash < 10_000);
});

test("risk guard caps leverage and risk", () => {
  const idea = { stopPct: 0.01, entry: 100, market: { fundingHourly: 0.0001 } } as unknown as Idea;
  const z = size(idea, 10_000, 0.5); // asks for 50% risk
  assert.ok(z.leverage <= 5 + 1e-9);
  assert.ok(z.riskUsd <= 10_000 * 0.02 + 1e-6 || z.capped);
});

test("a later non-zero funding rate never pays for time already elapsed", () => {
  let s = P.open(P.emptyState(), { symbol: "Z-USD", side: "long", entry: 10, notional: 1000, stop: 5, target: 20 });
  const t0 = s.positions[0].lastFundingAt;
  s = P.tick(s, { "Z-USD": 10 }, {}, t0 + 5 * 3_600_000); // 5h with no known rate
  s = P.tick(s, { "Z-USD": 10 }, { "Z-USD": 0.001 }, t0 + 5 * 3_600_000 + 1_000); // rate appears
  assert.ok(Math.abs(s.positions[0].fundingPaid) < 0.01, "retro-paid " + s.positions[0].fundingPaid);
});

test("tick does not mutate the input state", () => {
  const s0 = P.open(P.emptyState(), { symbol: "Q-USD", side: "short", entry: 10, notional: 100, stop: 11, target: 9 });
  const before = JSON.stringify(s0);
  P.tick(s0, { "Q-USD": 10 }, { "Q-USD": 0.001 }, s0.positions[0].lastFundingAt + 3_600_000);
  assert.equal(JSON.stringify(s0), before);
});
