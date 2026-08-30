import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DocumentUploader } from "./DocumentUploader";

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-900/60 text-emerald-300",
  pending: "bg-amber-900/60 text-amber-300",
  rejected: "bg-red-900/60 text-red-300",
  unverified: "bg-slate-800 text-slate-300",
};

const TYPE_LABELS: Record<string, string> = {
  id: "Government ID",
  operator_certificate: "Part 135 operator certificate",
  insurance: "Insurance certificate",
  registration: "Aircraft registration",
  airworthiness: "Airworthiness certificate",
};

export default async function OwnerDocuments() {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const [{ data: docs }, { data: aircraft }] = await Promise.all([
    supabase
      .from("verification_documents")
      .select("id, doc_type, status, expires_at, liability_limit, rejection_reason, aircraft_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("aircraft").select("id, name").eq("owner_id", user.id),
  ]);

  const aircraftName = new Map((aircraft ?? []).map((a) => [a.id, a.name]));
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Verification documents</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Operator credentials and aircraft documents are reviewed by our team.
        At launch, charter listings require a verified Part 135 operator
        certificate and insurance to go live. Documents with an expiry date are
        re-checked automatically.
      </p>

      <div className="mt-8 max-w-2xl">
        <DocumentUploader aircraftOptions={aircraft ?? []} />
      </div>

      <section className="mt-8 max-w-2xl">
        <h2 className="mb-3 font-semibold">Submitted</h2>
        {!docs?.length ? (
          <p className="text-sm text-slate-500">Nothing uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => {
              const expiringSoon =
                d.expires_at && new Date(d.expires_at) <= soon;
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-slate-800 bg-ink-soft px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {TYPE_LABELS[d.doc_type] ?? d.doc_type}
                        {d.aircraft_id && (
                          <span className="ml-2 text-slate-400">
                            · {aircraftName.get(d.aircraft_id) ?? "aircraft"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {d.expires_at ? `Expires ${d.expires_at}` : "No expiry set"}
                        {d.liability_limit
                          ? ` · Liability $${Number(d.liability_limit).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize ${STATUS_STYLES[d.status] ?? ""}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  {d.status === "rejected" && d.rejection_reason && (
                    <p className="mt-2 text-xs text-red-400">
                      Reason: {d.rejection_reason}. Upload a replacement above.
                    </p>
                  )}
                  {expiringSoon && d.status === "verified" && (
                    <p className="mt-2 text-xs text-amber-400">
                      Expiring within 30 days. Upload a renewal to stay listed.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
