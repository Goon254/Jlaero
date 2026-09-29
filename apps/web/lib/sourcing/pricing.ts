// Flexible markup engine. Policy gives per-tier defaults; every offer records
// the markup actually used. When a competitor price is known we undercut it
// by the policy's beat percentage, never below the minimum margin.

export type PricingPolicy = {
  tier: "value" | "preferred" | "premium";
  label: string;
  description: string;
  default_markup_pct: number;
  min_margin_pct: number;
  min_margin_abs: number;
  beat_competitor_by_pct: number;
  round_to: number;
};

export type PriceInput = {
  operatorCost: number;
  policy: PricingPolicy;
  competitorPrice?: number | null;
  manualPrice?: number | null;
};

export type PriceResult = {
  travelerPrice: number;
  markupAbs: number;
  markupPct: number;
  strategy: "target_margin" | "beat_competitor" | "manual";
  floor: number;
  note: string;
};

function roundUp(value: number, step: number) {
  if (!step || step <= 0) return Math.round(value * 100) / 100;
  return Math.ceil(value / step) * step;
}

export function priceOffer({ operatorCost, policy, competitorPrice, manualPrice }: PriceInput): PriceResult {
  const cost = Number(operatorCost);
  const floor = roundUp(
    Math.max(cost * (1 + Number(policy.min_margin_pct) / 100), cost + Number(policy.min_margin_abs)),
    policy.round_to
  );
  // The policy price never sits below the floor, whatever the markup says.
  const target = Math.max(roundUp(cost * (1 + Number(policy.default_markup_pct) / 100), policy.round_to), floor);

  let price = target;
  let strategy: PriceResult["strategy"] = "target_margin";
  let note = `Policy markup ${policy.default_markup_pct}% on operator cost.`;

  if (manualPrice != null && manualPrice > 0) {
    price = Math.max(Number(manualPrice), floor);
    strategy = "manual";
    note = price === Number(manualPrice)
      ? "Agent-set price."
      : `Agent price raised to the ${policy.min_margin_pct}% minimum margin floor.`;
  } else if (competitorPrice != null && competitorPrice > 0) {
    const beat = roundUp(Number(competitorPrice) * (1 - Number(policy.beat_competitor_by_pct) / 100), policy.round_to) - policy.round_to;
    const candidate = Math.min(target, Math.max(beat, floor));
    if (candidate < target) {
      price = candidate;
      strategy = "beat_competitor";
      note = candidate === floor
        ? `Competitor at ${competitorPrice} is below our target; priced at the minimum margin floor.`
        : `Undercuts competitor ${competitorPrice} by about ${policy.beat_competitor_by_pct}%.`;
    } else {
      note = `Already below competitor price ${competitorPrice}; policy markup kept.`;
    }
  }

  const markupAbs = Math.round((price - cost) * 100) / 100;
  const markupPct = cost > 0 ? Math.round((markupAbs / cost) * 10000) / 100 : 0;
  return { travelerPrice: price, markupAbs, markupPct, strategy, floor, note };
}

// Suggest a tier for a parsed quote from aircraft age, category and operator
// safety rating. Agents can override.
export function suggestTier(input: {
  category?: string | null;
  year?: number | null;
  argus?: string | null;
  wyvern?: string | null;
}): PricingPolicy["tier"] {
  const argus = (input.argus ?? "").toLowerCase();
  const wyvern = (input.wyvern ?? "").toLowerCase();
  const topSafety = argus.includes("platinum") || wyvern.includes("wingman");
  const newish = (input.year ?? 0) >= new Date().getFullYear() - 8;
  if (topSafety && newish) return "premium";
  if (topSafety || newish) return "preferred";
  return "value";
}
