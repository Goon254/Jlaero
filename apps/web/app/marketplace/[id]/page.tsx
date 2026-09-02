import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { publicPhotoUrl } from "@/lib/storage";
import { FavoriteReportBar } from "@/components/FavoriteReportBar";
import { InquiryForm } from "./InquiryForm";

export default async function SaleDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: listing } = await supabase
    .from("sale_listings")
    .select(
      "*, sale_listing_photos(id, file_path, position), profiles:seller_id(id, full_name, company_name, verification)"
    )
    .eq("id", id)
    .in("status", ["active", "under_offer"])
    .maybeSingle();
  if (!listing) notFound();

  const photos = [...(listing.sale_listing_photos ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const seller = listing.profiles as unknown as {
    id: string;
    full_name: string | null;
    company_name: string | null;
    verification: string;
  } | null;

  let isSaved = false;
  if (user) {
    const { data: fav } = await supabase
      .from("favorites")
      .select("target_id")
      .eq("user_id", user.id)
      .eq("target_type", "sale")
      .eq("target_id", id)
      .maybeSingle();
    isSaved = Boolean(fav);
  }

  return (
    <PageShell title={listing.title}>
      <p className="-mt-6 text-slate-400">
        {[listing.year, listing.manufacturer, listing.model].filter(Boolean).join(" ")}
        {listing.location ? ` · ${listing.location}` : ""}
        {listing.status === "under_offer" && (
          <span className="ml-2 rounded-full bg-sky-900/60 px-2.5 py-0.5 text-xs text-sky-300">
            Under offer
          </span>
        )}
      </p>
      <div className="mb-8">
        <FavoriteReportBar
          targetType="sale"
          targetId={id}
          meId={user?.id ?? null}
          initiallySaved={isSaved}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          {photos.length > 0 && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicPhotoUrl("sale-photos", photos[0]!.file_path)}
                alt={listing.title}
                className="aspect-[16/9] w-full rounded-2xl object-cover"
              />
              {photos.length > 1 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {photos.slice(1, 5).map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={publicPhotoUrl("sale-photos", p.file_path)}
                      alt=""
                      className="aspect-[4/3] w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {listing.description && (
            <section className="mt-8">
              <h2 className="mb-2 font-semibold">Details</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {listing.description}
              </p>
            </section>
          )}

          {seller && (
            <section className="mt-8 flex items-center justify-between rounded-2xl border border-slate-800 p-5">
              <div>
                <p className="text-sm text-slate-400">Sold by</p>
                <p className="font-medium">
                  {seller.company_name || seller.full_name || "Seller"}
                </p>
                {seller.verification === "verified" && (
                  <p className="mt-0.5 text-xs text-emerald-400">✓ Verified</p>
                )}
              </div>
              <Link
                href={`/operators/${seller.id}`}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-gold hover:text-gold"
              >
                View profile
              </Link>
            </section>
          )}

          <p className="mt-6 rounded-xl border border-slate-800 bg-ink-soft/50 p-4 text-xs text-slate-500">
            Aircraft sales on Jlaero are inquiry-only. Jlaero introduces buyer
            and seller; the transaction, escrow, title work, and pre-buy
            inspection are handled off-platform with your own advisors.
          </p>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-slate-800 bg-ink-soft p-6">
            {listing.price && (
              <p className="text-3xl font-semibold text-gold">
                ${Number(listing.price).toLocaleString()}
              </p>
            )}
            <InquiryForm listingId={id} signedIn={Boolean(user)} />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
