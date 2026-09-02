import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/storage";
import { PhotoUploader } from "@/components/PhotoUploader";
import { SaleForm } from "./SaleForm";
import { SaleStatusControls } from "./SaleStatusControls";

export default async function EditSale({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("owner");
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("sale_listings")
    .select("*")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();
  if (!listing) notFound();

  const { data: photos } = await supabase
    .from("sale_listing_photos")
    .select("id, file_path, position")
    .eq("listing_id", id)
    .order("position");

  const nextPosition =
    (photos?.length ? Math.max(...photos.map((p) => p.position)) : -1) + 1;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/owner/sales" className="text-sm text-slate-400 hover:text-gold">
            ← My sale listings
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{listing.title}</h1>
          <p className="text-sm capitalize text-slate-400">
            Status: {listing.status.replace(/_/g, " ")}
          </p>
        </div>
        <SaleStatusControls listingId={id} status={listing.status} />
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Photos</h2>
          <PhotoUploader
            recordId={id}
            nextPosition={nextPosition}
            bucket="sale-photos"
            table="sale_listing_photos"
            column="listing_id"
          />
        </div>
        {!photos?.length ? (
          <p className="text-sm text-slate-500">At least one photo is required to publish.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicPhotoUrl("sale-photos", p.file_path)}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 max-w-2xl">
        <SaleForm listing={listing} />
      </div>
    </main>
  );
}
