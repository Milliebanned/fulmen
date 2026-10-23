// Turns a Fulmen signal into a plain-English trade rationale.
// Provider order: Gemini (free tier, GEMINI_API_KEY) -> Claude (ANTHROPIC_API_KEY) -> deterministic template,
// so the app never breaks without a key.

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

let globalHits: number[] = [];
function globalLimited(max = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < windowMs);
  globalHits.push(now);
  return globalHits.length > max;
}

let geminiModel: string | null = null; // cached once a model answers

async function geminiCall(key: string, model: string, prompt: string): Promise<Response> {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
    }),
  });
}

/** Model ids change over time, so if a name 404s ask Google which Flash models this key can use. */
async function discoverGeminiModels(key: string): Promise<string[]> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
    headers: { "x-goog-api-key": key },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return (j?.models ?? [])
    .filter((m: { name?: string; supportedGenerationMethods?: string[] }) => m.name?.includes("flash") && m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: { name: string }) => m.name.replace(/^models\//, ""))
    .filter((n: string) => !/(image|tts|live|audio|embedding|thinking|exp)/.test(n));
}

async function viaGemini(key: string, prompt: string, notes: string[]): Promise<string | null> {
  const preferred = [geminiModel, process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean) as string[];
  const tried = new Set<string>();
  let queue = [...new Set(preferred)];
  let discovered = false;

  while (queue.length) {
    const model = queue.shift()!;
    if (tried.has(model)) continue;
    tried.add(model);
    const res = await geminiCall(key, model, prompt);
    if (res.ok) {
      const j = await res.json();
      const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
      if (text) {
        geminiModel = model;
        return text;
      }
      notes.push(`gemini ${model} empty (${j?.candidates?.[0]?.finishReason ?? j?.promptFeedback?.blockReason ?? "no candidates"})`);
      return null;
    }
    notes.push(`gemini ${model} HTTP ${res.status}`);
    // 404 = unknown model name, 429/503 = this model is busy: try the next one. Auth errors will not improve.
    if (![404, 429, 500, 503].includes(res.status)) return null;
    if (!queue.length && !discovered && res.status === 404) {
      discovered = true;
      queue = (await discoverGeminiModels(key)).slice(0, 4);
      if (!queue.length) notes.push("gemini model discovery returned nothing");
    }
  }
  return null;
}

async function viaClaude(key: string, prompt: string, notes: string[]): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    notes.push(`claude HTTP ${res.status}`);
    return null;
  }
  const j = await res.json();
  return j?.content?.find((c: { type: string }) => c.type === "text")?.text ?? null;
}

export async function POST(req: Request) {
  let b: Body | null = null;
  try {
    b = parse(await req.json());
  } catch {}
  if (!b) return Response.json({ error: "invalid body" }, { status: 400 });

  const gemini = process.env.GEMINI_API_KEY;
  const claude = process.env.ANTHROPIC_API_KEY;
  // Prefer platform-set headers (not client-controlled); add a global cap so rotating IPs cannot drain a key.
  const ip = (req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip") ?? "local").split(",")[0].trim();
  // Over the limit (or no key): still answer, but with the free deterministic summary.
  if (!gemini && !claude) return Response.json({ text: fallback(b), source: "template", notes: ["no AI key configured on the server"] });
  if (limited(ip) || globalLimited()) return Response.json({ text: fallback(b), source: "template", notes: ["rate limited"] });

  const facts = b.reasons.map((r) => `- [${r.tag}] ${r.text}`).join("\n");
  const prompt = `You are the analyst inside Fulmen, a trading terminal for Strike Finance perpetuals.
Write a concise trade rationale (max 90 words, 3 short sentences plus one risk sentence) for this idea.
Use ONLY the numbers given. Do not invent data, do not promise profit, no emojis.

Idea: ${b.side.toUpperCase()} ${b.symbol}, conviction ${b.conviction}/100
Entry ${px(b.entry)}, stop ${px(b.stop)}, target ${px(b.target)}
Market sentiment index: ${b.fearGreed ?? "n/a"}
Signals:
${facts}`;

  const notes: string[] = [];
  const attempts: [string, () => Promise<string | null>][] = [];
  if (gemini) attempts.push(["gemini", () => viaGemini(gemini, prompt, notes)]);
  if (claude) attempts.push(["claude", () => viaClaude(claude, prompt, notes)]);
  for (const [source, run] of attempts) {
    try {
      const text = await run();
      if (text) return Response.json({ text, source });
    } catch (e) {
      notes.push(`${source} error: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
    }
  }
  return Response.json({ text: fallback(b), source: "template", notes });
}
