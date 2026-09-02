import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewButtons } from "./ReviewButtons";

type DocRow = {
  id: string;
  doc_type: string;
  file_path: string;
  expires_at: string | null;
  liability_limit: number | null;
  created_at: string;
  profiles: { full_name: string | null; company_name: string | null } | null;
  aircraft: { name: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  id: "Government ID",
  operator_certificate: "Part 135 certificate",
  insurance: "Insurance",
  registration: "Registration",
  airworthiness: "Airworthiness",
  pilot_license: "Pilot license",
  medical: "Medical certificate",
};

export default async function VerificationQueue() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("verification_documents")
    .select(
      "id, doc_type, file_path, expires_at, liability_limit, created_at, profiles:user_id(full_name, company_name), aircraft:aircraft_id(name)"
    )
    .eq("status", "pending")
    .order("created_at");

  const docs = (data ?? []) as unknown as DocRow[];

  // Signed URLs so the reviewer can open the private files
  const urls = new Map<string, string>();
  for (const d of docs) {
    const { data: signed } = await supabase.storage
      .from("verification")
      .createSignedUrl(d.file_path, 3600);
    if (signed?.signedUrl) urls.set(d.id, signed.signedUrl);
  }

  return (
    <main>
      <h1 className="text-2xl font-semibold">Verification queue</h1>
      <p className="mt-2 text-sm text-slate-400">
        Approving a Part 135 certificate plus insurance marks the operator
        verified. Every decision is audited.
      </p>

      {!docs.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          Queue is clear.
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {docs.map((d) => (
            <li key={d.id} className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {TYPE_LABELS[d.doc_type] ?? d.doc_type}
                    <span className="ml-2 text-sm text-slate-400">
                      from {d.profiles?.company_name || d.profiles?.full_name || "Unknown"}
                    </span>
                    {d.aircraft && (
                      <span className="ml-2 text-sm text-slate-500">· {d.aircraft.name}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Submitted {new Date(d.created_at).toLocaleDateString()}
                    {d.expires_at ? ` · expires ${d.expires_at}` : " · no expiry given"}
                    {d.liability_limit
                      ? ` · liability $${Number(d.liability_limit).toLocaleString()}`
                      : ""}
                  </p>
                  {urls.get(d.id) && (
                    <a
                      href={urls.get(d.id)}
                      target="_blank"
                      className="mt-1 inline-block text-sm text-gold hover:underline"
                    >
                      Open document ↗
                    </a>
                  )}
                </div>
                <ReviewButtons docId={d.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
