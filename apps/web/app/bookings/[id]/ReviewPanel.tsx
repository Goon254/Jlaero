"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ReviewPanel({
  bookingId,
  meId,
  revieweeId,
  revieweeName,
  existing,
}: {
  bookingId: string;
  meId: string;
  revieweeId: string;
  revieweeName: string;
  existing: { rating: number; comment: string | null } | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
        <h2 className="font-semibold">Your review of {revieweeName}</h2>
        <p className="mt-2 text-gold">{"★".repeat(existing.rating)}{"☆".repeat(5 - existing.rating)}</p>
        {existing.comment && (
          <p className="mt-1 text-sm text-slate-300">{existing.comment}</p>
        )}
      </section>
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const { error } = await supabase.from("reviews").insert({
        booking_id: bookingId,
        reviewer_id: meId,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || null,
      });
      if (error) setError(error.message);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
      <h2 className="font-semibold">Review {revieweeName}</h2>
      <div className="mt-3 flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            className={n <= rating ? "text-gold" : "text-slate-700 hover:text-slate-500"}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="How was the experience? (optional)"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-ink px-4 py-3 text-sm outline-none focus:border-gold"
      />
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={pending || rating === 0}
        className="mt-3 w-full rounded-full bg-gold py-2.5 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </section>
  );
}
