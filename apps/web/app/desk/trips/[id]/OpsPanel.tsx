// Trip operations (spec s16-s21; blueprint s26-s28): AOG / replacement
// workflow, flight monitoring, completion, feedback, cancellation.
import { formatLocal, ISSUE_KIND_LABELS, ISSUE_KINDS } from "@jlaero/shared";
import { AlertTriangle } from "lucide-react";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, Field, Input, Notice, SectionTitle, Select, Textarea } from "@/components/lux/ui";
import { cancelTripAction, closeTripAction, completeTripAction, markActiveAction, replacementSearchAction, reportIssueAction, resolveIssueAction } from "./actions";
import type { DeskTrip } from "./data";

export function OpsPanel({ data, isBroker }: { data: DeskTrip; isBroker: boolean }) {
  const { trip, issues, feedback } = data;
  const s = trip.status;
  const openIssue = issues.find((i) => !i.resolved_at);
  const flying = ["confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours", "active", "operator_confirmation_pending", "payment_received"].includes(s);
  const finished = ["completed", "feedback_requested", "closed", "cancelled"].includes(s);

  return (
    <section aria-labelledby="ops-h" className="space-y-4">
      <SectionTitle><span id="ops-h">Operations</span></SectionTitle>

      {openIssue && (
        <Card className="border-bad/50 bg-bad-soft">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-bad" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-bad">Operational issue: replacement required</p>
              <p className="mt-1 text-sm">{ISSUE_KIND_LABELS[openIssue.kind as keyof typeof ISSUE_KIND_LABELS]} reported {openIssue.reported_via === "operator_email" ? "by operator email" : `by ${openIssue.reporter_name ?? "broker"}`} {formatLocal(openIssue.created_at, null, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg-2">{openIssue.description}</p>
              {isBroker && (
                <div className="mt-4 space-y-3">
                  {s === "operational_issue" && (
                    <ActionForm action={replacementSearchAction.bind(null, trip.id)} submitLabel="Start AI replacement search" pendingLabel="Searching..." />
                  )}
                  <p className="text-xs text-fg-3">
                    The search reuses the original route, date, time, passengers, aircraft requirements, services and special requests.
                    Replacement quotes come to you first; nothing reaches the client until you send options.
                  </p>
                  <details>
                    <summary className="cursor-pointer text-sm text-fg-2">Resolved without changing aircraft?</summary>
                    <ActionForm action={resolveIssueAction.bind(null, trip.id)} submitLabel="Resolve and restore trip" variant="secondary" className="mt-3">
                      <Field label="Resolution"><Input name="resolution" placeholder="Maintenance completed, aircraft released." /></Field>
                    </ActionForm>
                  </details>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {isBroker && flying && !openIssue && (
        <Card>
          <details>
            <summary className="cursor-pointer font-semibold">Report an aircraft or operator problem</summary>
            <p className="mt-2 text-sm text-fg-2">Flags the trip immediately and alerts every broker. Operator emails about AOG are detected automatically.</p>
            <ActionForm action={reportIssueAction.bind(null, trip.id)} submitLabel="Flag operational issue" variant="danger" className="mt-3" confirm="Flag this trip as needing a replacement aircraft?">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Issue">
                  <Select name="kind" defaultValue="aog">{ISSUE_KINDS.map((k) => <option key={k} value={k}>{ISSUE_KIND_LABELS[k]}</option>)}</Select>
                </Field>
                <Field label="Reported via">
                  <Select name="via" defaultValue="operator_phone">
                    <option value="operator_phone">Operator phone call</option>
                    <option value="operator_email">Operator email</option>
                    <option value="broker">Broker observation</option>
                    <option value="tracking">Flight tracking</option>
                  </Select>
                </Field>
              </div>
              <Field label="Details"><Textarea name="description" required placeholder="G450 N123AB AOG at TEB, hydraulic leak; operator has no substitute." /></Field>
            </ActionForm>
          </details>
        </Card>
      )}

      {isBroker && !finished && (
        <Card>
          <div className="flex flex-wrap gap-3">
            {["confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours"].includes(s) && (
              <ActionForm action={markActiveAction.bind(null, trip.id)} submitLabel="Mark trip active" variant="secondary" />
            )}
            {["active", "within_72_hours", "itinerary_ready", "confirmed", "itinerary_pending"].includes(s) && (
              <ActionForm action={completeTripAction.bind(null, trip.id)} submitLabel="Mark trip completed" confirm="Mark completed? The client gets a thank-you and a feedback request." />
            )}
          </div>
          <p className="mt-3 text-xs text-fg-3">
            Trips turn active automatically shortly before departure. Live tracking will attach here once a tracking provider is connected.
          </p>
        </Card>
      )}

      {feedback && (
        <Card>
          <h3 className="font-display text-lg font-semibold">Client feedback</h3>
          <p className="mt-1 text-2xl text-accent-text" aria-label={`${feedback.rating} out of 5`}>{"★".repeat(feedback.rating)}<span className="text-line-strong">{"★".repeat(5 - feedback.rating)}</span></p>
          {feedback.comments && <p className="mt-2 text-sm">{feedback.comments}</p>}
          {Object.keys(feedback.categories ?? {}).length > 0 && (
            <p className="mt-2 text-xs text-fg-3">{Object.entries(feedback.categories as Record<string, number>).map(([k, v]) => `${k} ${v}/5`).join(" · ")}</p>
          )}
        </Card>
      )}

      {isBroker && ["completed", "feedback_requested"].includes(s) && (
        <ActionForm action={closeTripAction.bind(null, trip.id)} submitLabel="Close trip" variant="secondary" />
      )}

      {isBroker && !finished && (
        <details className="rounded-2xl border border-line p-4">
          <summary className="cursor-pointer text-sm text-fg-2">Cancel this trip</summary>
          <Notice tone="warn">Cancelling withdraws open options and voids an unsigned contract. Refunds are recorded by finance on the payment.</Notice>
          <ActionForm action={cancelTripAction.bind(null, trip.id)} submitLabel="Cancel trip" variant="danger" className="mt-3" confirm="Cancel this trip?">
            <Field label="Reason"><Input name="reason" required /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_client" defaultChecked className="h-4 w-4 accent-[var(--accent)]" /> Email the client</label>
          </ActionForm>
        </details>
      )}
    </section>
  );
}
