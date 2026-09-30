// Three-option engine (blueprint s14). Ranks verified quotes on availability,
// aircraft fit, capacity, price, operator standing and response, then picks
// up to three distinct aircraft types so the client gets a real choice.
// This only recommends; the broker approves before anything is sent.

export type RankableQuote = {
  id: string;
  status: string;
  availability: string;
  aircraft_type: string;
  aircraft_category: string | null;
  passenger_capacity: number | null;
  client_price: number | string;
  expires_at: Date | string | null;
  source: string;
  confidence: number | string | null;
  network_status?: string | null;
  is_replacement: boolean;
};

export type Recommendation = { quoteId: string; score: number; reasons: string[] };

export function recommendOptions(
  quotes: RankableQuote[],
  trip: { passengers: number; aircraft_category: string | null; aircraft_preference: string | null },
  opts: { replacement?: boolean } = {}
): Recommendation[] {
  const pool = quotes.filter((q) =>
    ["approved", "pending_review", "option_sent"].includes(q.status) &&
    q.availability !== "unavailable" &&
    Boolean(q.is_replacement) === Boolean(opts.replacement) &&
    (!q.expires_at || new Date(q.expires_at).getTime() > Date.now()) &&
    (!q.passenger_capacity || q.passenger_capacity >= trip.passengers)
  );
  if (!pool.length) return [];
  const prices = pool.map((q) => Number(q.client_price));
  const min = Math.min(...prices), max = Math.max(...prices);
  const pref = (trip.aircraft_preference ?? "").toLowerCase();

  const scored = pool.map((q) => {
    const reasons: string[] = [];
    let score = 0;
    if (q.status !== "pending_review") { score += 25; } else { reasons.push("needs verification first"); }
    if (q.availability === "available") { score += 20; reasons.push("availability confirmed"); }
    if (pref && q.aircraft_type.toLowerCase().includes(pref.split(" ").pop() ?? pref)) { score += 25; reasons.push("matches the requested aircraft"); }
    else if (trip.aircraft_category && q.aircraft_category === trip.aircraft_category) { score += 15; reasons.push("requested aircraft class"); }
    if (q.passenger_capacity) {
      const spare = q.passenger_capacity - trip.passengers;
      if (spare >= 0 && spare <= 4) { score += 8; reasons.push("right-sized cabin"); }
    }
    const price = Number(q.client_price);
    const priceScore = max > min ? (1 - (price - min) / (max - min)) * 30 : 15;
    score += priceScore;
    if (price === min) reasons.push("lowest price");
    if (q.network_status === "preferred") { score += 10; reasons.push("preferred operator"); }
    else if (q.network_status === "approved") score += 5;
    if (q.source === "manual" || q.source === "api") score += 5;
    else if (q.confidence != null && Number(q.confidence) < 0.7) { score -= 10; reasons.push("low AI extraction confidence"); }
    return { quoteId: q.id, score: Math.round(score), reasons, type: q.aircraft_type.toLowerCase(), price };
  }).sort((a, b) => b.score - a.score || a.price - b.price);

  // Diversity: prefer distinct aircraft types across the three slots.
  const picked: typeof scored = [];
  for (const s of scored) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.type === s.type)) picked.push(s);
  }
  for (const s of scored) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.map(({ quoteId, score, reasons }) => ({ quoteId, score, reasons }));
}
