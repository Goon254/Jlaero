"use client";

import { useActionState } from "react";
import { sendInquiry, type SaleState } from "../../owner/sales/actions";

export function InquiryForm({
  listingId,
  signedIn,
}: {
  listingId: string;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<SaleState, FormData>(
    sendInquiry.bind(null, listingId),
    {}
  );

  if (!signedIn) {
    return (
      <a
        href="/login"
        className="mt-4 block rounded-full bg-gold py-3 text-center font-medium text-ink hover:bg-gold-light"
      >
        Sign in to inquire
      </a>
    );
  }

  return (
    <form action={formAction} className="mt-4">
      <textarea
        name="message"
        rows={3}
        required
        placeholder="Ask about times, maintenance status, pre-buy availability…"
        className="w-full rounded-lg border border-slate-700 bg-ink px-4 py-3 text-sm outline-none focus:border-gold"
      />
      {state.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        className="mt-3 w-full rounded-full bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send inquiry"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">
        Opens a direct conversation with the seller.
      </p>
    </form>
  );
}
