// Operator search and RFQ emails (blueprint s9-s11; spec s31 "what operators
// were contacted"). AI matches operators and drafts emails; nothing is sent
// until a broker reviews each one.
import { formatLocal } from "@jlaero/shared";
import { Search } from "lucide-react";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, Field, Input, Pill, SectionTitle, Textarea, type Tone } from "@/components/lux/ui";
import { sendRfqAction, skipRfqAction, startSearchAction } from "./actions";
import type { DeskTrip } from "./data";

const STATUS_TONE: Record<string, Tone> = {
  draft: "warn", approved: "info", sent: "info", replied: "accent", quoted: "ok", declined: "neutral", bounced: "bad", no_response: "neutral",
};

export function SourcingPanel({ data }: { data: DeskTrip }) {
  const { trip, rfqs, recipients, settings } = data;
  const searchable = ["new_request", "searching", "quotes_received", "broker_review", "options_sent", "operational_issue", "replacement_search"].includes(trip.status);
  const replacement = ["operational_issue", "replacement_search"].includes(trip.status);
  const counts = recipients.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});

  return (
    <section aria-labelledby="sourcing-h" className="space-y-4">
      <SectionTitle><span id="sourcing-h">Operator search</span></SectionTitle>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl text-sm text-fg-2">
            <p>
              Searches approved operators at or near {trip.origin_icao}, then {trip.destination_icao}, then within {Number(trip.search_radius_miles)} miles,
              filtered by {trip.passengers} passengers and aircraft requirements{settings.search.include_prospects ? ", with FAA-listed prospects as a fallback" : ""}.
              AI drafts one request email per operator for you to review.
            </p>
            {rfqs.length > 0 && (
              <p className="mt-2">
                {rfqs.length} round{rfqs.length === 1 ? "" : "s"}: {Object.entries(counts).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(", ")}
              </p>
            )}
          </div>
          {searchable && (
            <ActionForm action={startSearchAction.bind(null, trip.id)} submitLabel={<><Search className="h-4 w-4" aria-hidden /> {replacement ? "Search replacements" : rfqs.length ? "Search again" : "Run operator search"}</>} pendingLabel="Searching..." variant="secondary" />
          )}
        </div>
      </Card>

      {recipients.length > 0 && (
        <div className="space-y-2">
          {recipients.map((r) => (
            <Card key={r.id} padded={false}>
              <details open={r.status === "draft" && Boolean(r.to_email)}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                  <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Pill>
                  {r.purpose === "replacement" && <Pill tone="bad">Replacement</Pill>}
                  <span className="font-semibold">{r.operator_name}</span>
                  <span className="text-xs text-fg-3">Round {r.round}{r.network_status !== "prospect" ? ` · ${r.network_status}` : " · prospect"}</span>
                  <span className="ml-auto text-xs text-fg-3">
                    {r.sent_at ? `Sent ${formatLocal(r.sent_at, null, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : r.to_email ? r.to_email : "No email on file"}
                    {r.replies ? ` · ${r.replies} repl${r.replies === 1 ? "y" : "ies"}` : ""}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-line p-4">
                  <p className="text-xs text-fg-3">Why matched: {r.match_reason}{r.draft_model ? ` · drafted by ${r.draft_model}` : ""}</p>
                  {r.status === "draft" ? (
                    <>
                      <ActionForm action={sendRfqAction.bind(null, trip.id, r.id)} submitLabel="Approve and send" confirm={`Send this request to ${r.operator_name}?`}>
                        <Field label="To"><Input name="to_email" type="email" defaultValue={r.to_email ?? ""} placeholder="charter@operator.com" required /></Field>
                        <Field label="Subject"><Input name="subject" defaultValue={r.subject ?? ""} /></Field>
                        <Field label="Message"><Textarea name="body" rows={10} defaultValue={r.body_text ?? ""} className="font-mono text-xs" /></Field>
                      </ActionForm>
                      <ActionForm action={skipRfqAction.bind(null, trip.id, r.id)} submitLabel="Skip this operator" variant="ghost" />
                    </>
                  ) : (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-sunken p-3 text-xs text-fg-2">{r.subject}{"\n\n"}{r.body_text}</pre>
                  )}
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
