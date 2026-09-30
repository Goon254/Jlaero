import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { markdownToHtml } from "@/lib/markdown";
import { requireStaff } from "@/lib/trips/access";
import { PrintButton } from "@/components/lux/PrintButton";
import { Pill } from "@/components/lux/ui";

export default async function DeskContractPage({ params }: { params: Promise<{ id: string; contractId: string }> }) {
  const { id, contractId } = await params;
  await requireStaff("view");
  const [c] = await db()`select * from trip_contracts where id = ${contractId} and trip_id = ${id}`;
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href={`/desk/trips/${id}`} className="text-sm text-fg-2 hover:text-fg">Back to trip</Link>
        <Pill tone={c.status === "signed" ? "ok" : "info"}>{c.status}</Pill>
        <span className="text-xs text-fg-3">SHA-256 {String(c.body_sha256).slice(0, 16)}...</span>
        <span className="ml-auto"><PrintButton /></span>
      </div>
      <article className="print-sheet doc rounded-2xl border border-line bg-surface p-6 sm:p-10" dangerouslySetInnerHTML={{ __html: markdownToHtml(c.rendered_body) }} />
      {c.status === "signed" && (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm">
          Signed electronically by <strong>{c.signer_name}</strong> ({c.signer_email}) on {new Date(c.signed_at).toUTCString()} from IP {c.signer_ip ?? "unknown"}.
        </p>
      )}
    </div>
  );
}
