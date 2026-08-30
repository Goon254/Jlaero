"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

const DOC_TYPES = [
  { value: "id", label: "Government ID", scope: "operator" },
  { value: "operator_certificate", label: "Part 135 operator certificate", scope: "operator" },
  { value: "insurance", label: "Insurance certificate", scope: "either" },
  { value: "registration", label: "Aircraft registration", scope: "aircraft" },
  { value: "airworthiness", label: "Airworthiness certificate", scope: "aircraft" },
] as const;

export function DocumentUploader({
  aircraftOptions,
}: {
  aircraftOptions: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [docType, setDocType] = useState<string>("operator_certificate");
  const [aircraftId, setAircraftId] = useState("");
  const [expires, setExpires] = useState("");
  const [liability, setLiability] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = DOC_TYPES.find((d) => d.value === docType);
  const needsAircraft = meta?.scope === "aircraft";
  const isInsurance = docType === "insurance";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Choose a file");
    if (needsAircraft && !aircraftId) return setError("Select the aircraft");
    if (file.size > 20 * 1024 * 1024) return setError("File is over 20MB");
    setBusy(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return setError("Not signed in");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("verification")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setError(upErr.message);
    }

    const { error: dbErr } = await supabase.from("verification_documents").insert({
      user_id: user.id,
      doc_type: docType,
      file_path: path,
      aircraft_id: needsAircraft || (isInsurance && aircraftId) ? aircraftId || null : null,
      expires_at: expires || null,
      liability_limit: isInsurance && liability ? Number(liability) : null,
    });
    setBusy(false);
    if (dbErr) return setError(dbErr.message);

    setFile(null);
    setExpires("");
    setLiability("");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-5"
    >
      <h2 className="mb-4 font-semibold">Upload a document</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Document type</span>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {(needsAircraft || isInsurance) && (
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">
              Aircraft{isInsurance ? " (optional for fleet policies)" : ""}
            </span>
            <select value={aircraftId} onChange={(e) => setAircraftId(e.target.value)} className={input}>
              <option value="">Select…</option>
              {aircraftOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Expiry date</span>
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={input} />
        </label>
        {isInsurance && (
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Liability limit (USD)</span>
            <input
              type="number"
              value={liability}
              onChange={(e) => setLiability(e.target.value)}
              className={input}
              placeholder="50000000"
            />
          </label>
        )}
      </div>
      <div className="mt-4">
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-400 file:mr-4 file:rounded-full file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-slate-200"
        />
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button
        disabled={busy}
        className="mt-4 rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
