"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Creates (or resumes) Stripe Connect onboarding for a provider.
// Accounts v2: recipient configuration, express dashboard, platform owns
// fees and loss liability (see ROADMAP 3c and Stripe Connect guidance).
export async function startConnectOnboarding(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sql = db();
  const [existing] = await sql`
    select stripe_account_id from stripe_accounts where user_id = ${user.id}
  `;

  let accountId = existing?.stripe_account_id as string | undefined;
  if (!accountId) {
    const s = stripe() as unknown as {
      v2: {
        core: {
          accounts: { create: (params: object) => Promise<{ id: string }> };
        };
      };
    };
    const account = await s.v2.core.accounts.create({
      contact_email: user.email,
      display_name: user.email,
      identity: { country: "US" },
      dashboard: "express",
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
        locales: ["en-US"],
        currency: "usd",
      },
      include: ["configuration.recipient", "identity", "requirements"],
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: { stripe_transfers: { requested: true } },
          },
        },
      },
      metadata: { jlaero_user_id: user.id },
    });
    accountId = account.id;
    await sql`
      insert into stripe_accounts (user_id, stripe_account_id)
      values (${user.id}, ${accountId})
      on conflict (user_id) do nothing
    `;
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/settings/payments`,
    return_url: `${origin}/settings/payments?onboarded=1`,
  });
  redirect(link.url);
}

// Refreshes capability status from Stripe (v2 recipient capability path).
export async function syncConnectStatus(userId: string): Promise<boolean> {
  const sql = db();
  const [row] = await sql`
    select stripe_account_id from stripe_accounts where user_id = ${userId}
  `;
  if (!row) return false;

  try {
    const s = stripe() as unknown as {
      v2: {
        core: {
          accounts: {
            retrieve: (id: string, params?: object) => Promise<{
              configuration?: {
                recipient?: {
                  capabilities?: {
                    stripe_balance?: { stripe_transfers?: { status?: string } };
                  };
                };
              };
            }>;
          };
        };
      };
    };
    const account = await s.v2.core.accounts.retrieve(row.stripe_account_id, {
      include: ["configuration.recipient"],
    });
    const active =
      account.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status === "active";
    await sql`
      update stripe_accounts
      set payouts_enabled = ${active}, charges_enabled = ${active}
      where user_id = ${userId}
    `;
    return active;
  } catch {
    return false;
  }
}
