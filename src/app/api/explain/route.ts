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

export async function POST(req: Request) {
  const b = (await req.json()) as Body;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ text: fallback(b), source: "template" });

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
