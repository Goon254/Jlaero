import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/storage";

export default async function Marketplace({
  searchParams,
}: {
  searchParams: Promise<{ make?: string; max_price?: string; min_year?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("sale_listings")
    .select(
      "id, title, manufacturer, model, year, price, location, status, sale_listing_photos(file_path, position)"
    )
    .in("status", ["active", "under_offer"]);
  if (params.make) query = query.ilike("manufacturer", `%${params.make}%`);
  if (params.max_price) query = query.lte("price", Number(params.max_price));
  if (params.min_year) query = query.gte("year", Number(params.min_year));

  const { data: listings } = await query.order("created_at", { ascending: false }).limit(60);

  return (
    <PageShell
      title="Aircraft for sale"
      subtitle="Inquiry-based listings. Jlaero connects you with the seller; transactions complete off-platform with your own counsel and escrow."
    >
      <form method="GET" className="mb-8 flex flex-wrap gap-3">
        <input
          name="make"
          defaultValue={params.make ?? ""}
          placeholder="Manufacturer"
          className="w-44 rounded-lg border border-slate-700 bg-ink-soft px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        <input
          name="min_year"
          type="number"
          defaultValue={params.min_year ?? ""}
          placeholder="Min year"
          className="w-32 rounded-lg border border-slate-700 bg-ink-soft px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        <input
          name="max_price"
          type="number"
          defaultValue={params.max_price ?? ""}
          placeholder="Max price"
          className="w-36 rounded-lg border border-slate-700 bg-ink-soft px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        <button className="rounded-lg bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light">
          Filter
        </button>
      </form>

      {!listings?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No aircraft for sale right now. Selling one?{" "}
          <Link href="/owner/sales" className="text-gold hover:underline">
            List it →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {listings.map((l) => {
            const cover = [...(l.sale_listing_photos ?? [])].sort(
              (x, y) => x.position - y.position
            )[0];
            return (
              <li key={l.id}>
                <Link
                  href={`/marketplace/${l.id}`}
                  className="block overflow-hidden rounded-2xl border border-slate-800 bg-ink-soft hover:border-gold"
                >
                  <div className="relative aspect-[16/9] bg-slate-900">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={publicPhotoUrl("sale-photos", cover.file_path)}
                        alt={l.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                    {l.status === "under_offer" && (
                      <span className="absolute left-3 top-3 rounded-full bg-sky-900/90 px-3 py-1 text-xs text-sky-200">
                        Under offer
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold">{l.title}</h2>
                      {l.price && (
                        <p className="shrink-0 font-semibold text-gold">
                          ${Number(l.price).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {[l.year, l.manufacturer, l.model].filter(Boolean).join(" ")}
                      {l.location ? ` · ${l.location}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
