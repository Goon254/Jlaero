import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startConnectOnboarding, syncConnectStatus } from "./actions";

export default async function PaymentSettings({
  searchParams,
}: {
  searchParams: Promise<{ onboarded?: string }>;
}) {
  const { onboarded } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("stripe_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  // On return from Stripe onboarding, refresh capability status.
  let payoutsEnabled = account?.payouts_enabled ?? false;
  if (account && (onboarded || !payoutsEnabled)) {
    payoutsEnabled = await syncConnectStatus(user.id);
  }

  const isProvider = user.roles.includes("owner") || user.roles.includes("crew");

  return (
    <PageShell
      title="Payments"
      subtitle="How you pay, and how you get paid."
    >
      <div className="max-w-xl space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-ink-soft p-6">
          <h2 className="font-semibold">Paying for charters</h2>
          <p className="mt-2 text-sm text-slate-400">
            Payments are processed securely by Stripe at checkout. No card
            details are stored on Jlaero.
          </p>
        </section>

        {isProvider && (
          <section className="rounded-2xl border border-slate-800 bg-ink-soft p-6">
            <h2 className="font-semibold">Getting paid (providers)</h2>
            {!account ? (
              <>
                <p className="mt-2 text-sm text-slate-400">
                  Set up your payout account with Stripe to receive charter
                  earnings. Takes a few minutes; you will need your business
                  and bank details.
                </p>
                <form action={startConnectOnboarding} className="mt-4">
                  <button className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light">
                    Set up payouts
                  </button>
                </form>
              </>
            ) : payoutsEnabled ? (
              <p className="mt-2 text-sm text-emerald-400">
                ✓ Payouts are active. Earnings transfer automatically after
                each completed trip, minus the 10% platform fee.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-amber-400">
                  Your payout account needs more information before transfers
                  can start.
                </p>
                <form action={startConnectOnboarding} className="mt-4">
                  <button className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light">
                    Continue setup
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}
