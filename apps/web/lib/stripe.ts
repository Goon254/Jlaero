import Stripe from "stripe";

// Single StripeClient instance (never the deprecated global-key pattern).
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-08-26.dahlia" as Stripe.LatestApiVersion,
      appInfo: { name: "Jlaero", url: "https://jlaero.com" },
    });
  }
  return client;
}

// Deposit fraction of the accepted quote total (open decision; default 25%).
export const DEPOSIT_RATE = 0.25;
