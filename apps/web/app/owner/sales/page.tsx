import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/storage";
import { createSaleDraft } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-900/60 text-emerald-300",
  draft: "bg-slate-800 text-slate-300",
  under_offer: "bg-sky-900/60 text-sky-300",
  sold: "bg-gold/20 text-gold",
  archived: "bg-slate-900 text-slate-500",
};

export default async function MySales() {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const [{ data: listings }, { data: inquiries }] = await Promise.all([
    supabase
      .from("sale_listings")
      .select("id, title, price, status, sale_listing_photos(file_path, position)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("sale_inquiries")
      .select("id, listing_id, message, created_at, profiles:from_user(full_name)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Aircraft for sale</h1>
        <form action={createSaleDraft}>
          <button className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light">
            + New sale listing
          </button>
        </form>
      </div>

      {!listings?.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No sale listings yet.
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {listings.map((l) => {
            const cover = [...(l.sale_listing_photos ?? [])].sort(
              (x, y) => x.position - y.position
            )[0];
            return (
              <li
                key={l.id}
                className="flex items-center gap-5 rounded-2xl border border-slate-800 bg-ink-soft p-4"
              >
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-900">
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicPhotoUrl("sale-photos", cover.file_path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.title}</p>
                  <p className="text-sm text-slate-400">
                    {l.price ? `$${Number(l.price).toLocaleString()}` : "No price set"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs capitalize ${STATUS_STYLES[l.status] ?? ""}`}
                >
                  {l.status.replace(/_/g, " ")}
                </span>
                <Link
                  href={`/owner/sales/${l.id}/edit`}
                  className="rounded-full border border-slate-700 px-4 py-1.5 text-sm hover:border-gold hover:text-gold"
                >
                  Edit
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(inquiries?.length ?? 0) > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-semibold">Recent inquiries</h2>
          <ul className="space-y-2">
            {inquiries!.map((i) => {
              const from = i.profiles as unknown as { full_name: string | null } | null;
              return (
                <li key={i.id} className="rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 text-sm">
                  <span className="font-medium">{from?.full_name ?? "Someone"}</span>
                  <span className="ml-2 text-slate-400">{i.message}</span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(i.created_at).toLocaleDateString()} · reply in Messages
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
