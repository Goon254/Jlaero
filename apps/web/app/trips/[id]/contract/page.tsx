import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { markdownToHtml } from "@/lib/markdown";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/lux/ActionForm";
import { ClientShell } from "@/components/lux/ClientShell";
import { Card, EmptyState, Eyebrow, Field, Input, Notice, Pill } from "@/components/lux/ui";
import { signContract } from "../../_lib/actions";
import { PrintButton } from "@/components/lux/PrintButton";

export const metadata = { title: "Charter agreement | Jlaero" };

// Review -> Sign -> Submit (spec s9). The client signs the exact text shown;
// its SHA-256 is checked again inside sign_trip_contract.
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${id}/contract`);
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, trip_number, status").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data: rows } = await supabase
    .from("trip_contracts")
    .select("id, contract_number, template_version, rendered_body, body_sha256, status, sent_at, signer_name, signed_at, total_amount, currency")
    .eq("trip_id", id)
    .in("status", ["sent", "signed"])
    .order("created_at", { ascending: false })
    .limit(1);
  const contract = rows?.[0];

  return (
    <ClientShell>
      <nav aria-label="Breadcrumb" className="no-print mb-6 text-sm text-fg-3">
        <Link href="/trips" className="hover:text-fg">My trips</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/trips/${id}`} className="hover:text-fg">{trip.trip_number}</Link> <span aria-hidden>/</span> <span className="text-fg-2">Agreement</span>
      </nav>
      {!contract ? (
        <EmptyState title="No agreement yet" body="Your broker will send your charter agreement once your selected aircraft is verified." />
      ) : (
        <div className="space-y-6">
          <div className="no-print flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow className="mb-2">Charter agreement</Eyebrow>
              <h1 className="font-display text-3xl font-semibold">{contract.contract_number}</h1>
              <p className="mt-1 text-sm text-fg-3">Template version {contract.template_version}</p>
            </div>
            <div className="flex items-center gap-3">
              {contract.status === "signed" ? <Pill tone="ok">Signed</Pill> : <Pill tone="info">Awaiting your signature</Pill>}
              <PrintButton />
            </div>
          </div>

          <Card className="print-sheet">
            <article className="doc" dangerouslySetInnerHTML={{ __html: markdownToHtml(contract.rendered_body) }} />
            {contract.status === "signed" && (
              <div className="mt-8 border-t border-line pt-6 text-sm">
                <p className="font-semibold">Signed electronically by {contract.signer_name}</p>
                <p className="text-fg-2">{new Date(contract.signed_at!).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}</p>
                <p className="mt-2 break-all text-xs text-fg-3">Document fingerprint (SHA-256): {contract.body_sha256}</p>
              </div>
            )}
          </Card>

          {contract.status === "sent" && trip.status === "contract_sent" && (
            <Card className="no-print">
              <h2 className="font-display text-xl font-semibold">Sign your agreement</h2>
              <p className="mt-1 text-sm text-fg-2">Signing opens payment. Your trip is confirmed only after payment is received and verified and the operator confirms the aircraft.</p>
              <div className="mt-5">
                <ActionForm action={signContract.bind(null, id, contract.id, contract.body_sha256)} submitLabel="Sign agreement" pendingLabel="Signing...">
                  <Field label="Full legal name" htmlFor="signer_name" hint="Type your name exactly as you would sign it.">
                    <Input id="signer_name" name="signer_name" autoComplete="name" required minLength={3} />
                  </Field>
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm">
                    <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
                    <span>I agree to sign electronically and to the terms above.</span>
                  </label>
                </ActionForm>
              </div>
            </Card>
          )}
          {contract.status === "sent" && trip.status !== "contract_sent" && (
            <Notice tone="neutral" title="Not open for signature">This agreement is not currently awaiting your signature. Contact your broker if you think this is wrong.</Notice>
          )}
        </div>
      )}
    </ClientShell>
  );
}
