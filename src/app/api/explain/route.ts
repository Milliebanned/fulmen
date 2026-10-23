// Turns a Fulmen signal into a plain-English trade rationale.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise returns a deterministic summary so the app never breaks.

interface Body {
  symbol: string;
  side: "long" | "short";
  conviction: number;
  entry: number;
  stop: number;
  target: number;
  fearGreed?: number;
  reasons: { tag: string; text: string; tone: string }[];
}

const px = (n: number) => (n >= 1000 ? n.toFixed(1) : n >= 1 ? n.toFixed(3) : n.toPrecision(4));

function fallback(b: Body): string {
  const lead = b.reasons.find((r) => r.tag === "Funding")?.text ?? "";
  const risk = b.reasons.find((r) => r.tag === "Risk");
  return (
    `${b.side.toUpperCase()} ${b.symbol} (conviction ${b.conviction}/100). ${lead} ` +
    `Plan: enter near ${px(b.entry)}, stop ${px(b.stop)}, target ${px(b.target)} (2:1 reward to risk). ` +
    (risk ? `Watch out: ${risk.text}` : "No elevated risk flags right now.")
  );
}

// The route is public, so validate input and rate-limit per IP before spending any API credit.
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function parse(raw: unknown): Body | null {
  const b = raw as Partial<Body> | null;
  if (!b || typeof b.symbol !== "string" || !/^[A-Z0-9._-]{1,24}$/.test(b.symbol)) return null;
  if (b.side !== "long" && b.side !== "short") return null;
  if (![b.conviction, b.entry, b.stop, b.target].every(finite)) return null;
  if (!Array.isArray(b.reasons) || b.reasons.length > 8) return null;
  const reasons = b.reasons
    .filter((r) => r && typeof r.tag === "string" && typeof r.text === "string")
    .map((r) => ({ tag: r.tag.slice(0, 20), text: r.text.slice(0, 400), tone: String(r.tone ?? "").slice(0, 10) }));
  return {
    symbol: b.symbol,
    side: b.side,
    conviction: b.conviction as number,
    entry: b.entry as number,
    stop: b.stop as number,
    target: b.target as number,
    fearGreed: finite(b.fearGreed) ? b.fearGreed : undefined,
    reasons,
  };
}

const hits = new Map<string, number[]>();
function limited(ip: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

export async function POST(req: Request) {
  let b: Body | null = null;
  try {
    b = parse(await req.json());
  } catch {}
  if (!b) return Response.json({ error: "invalid body" }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  // Over the limit (or no key): still answer, but with the free deterministic summary.
  if (!key || limited(ip)) return Response.json({ text: fallback(b), source: "template" });

  const facts = b.reasons.map((r) => `- [${r.tag}] ${r.text}`).join("\n");
  const prompt = `You are the analyst inside Fulmen, a trading terminal for Strike Finance perpetuals.
Write a concise trade rationale (max 90 words, 3 short sentences plus one risk sentence) for this idea.
Use ONLY the numbers given. Do not invent data, do not promise profit, no emojis.

Idea: ${b.side.toUpperCase()} ${b.symbol}, conviction ${b.conviction}/100
Entry ${px(b.entry)}, stop ${px(b.stop)}, target ${px(b.target)}
Market sentiment index: ${b.fearGreed ?? "n/a"}
Signals:
${facts}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return Response.json({ text: fallback(b), source: "template" });
    const j = await res.json();
    const text = j?.content?.find((c: { type: string }) => c.type === "text")?.text;
    return Response.json({ text: text || fallback(b), source: text ? "claude" : "template" });
  } catch {
    return Response.json({ text: fallback(b), source: "template" });
  }
}
