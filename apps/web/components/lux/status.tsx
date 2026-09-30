import { CLIENT_STATUS_LABELS, QUOTE_SOURCE_LABELS, QUOTE_STATUS_LABELS, PAYMENT_STATUS_LABELS, TRIP_STATUS_LABELS, type QuoteSource, type QuoteStatus, type TripPaymentStatus, type TripStatus } from "@jlaero/shared";
import { Pill, type Tone } from "./ui";

export function tripTone(s: TripStatus): Tone {
  if (["operational_issue", "replacement_search"].includes(s)) return "bad";
  if (["client_selected", "payment_pending", "payment_received", "operator_confirmation_pending", "quotes_received", "broker_review", "new_request"].includes(s)) return "warn";
  if (["confirmed", "itinerary_ready", "within_72_hours", "active"].includes(s)) return "ok";
  if (["options_sent", "contract_sent", "replacement_pending_client"].includes(s)) return "info";
  if (["cancelled"].includes(s)) return "neutral";
  return "accent";
}

export function TripStatusPill({ status, audience = "staff" }: { status: TripStatus; audience?: "staff" | "client" }) {
  return <Pill tone={tripTone(status)}>{audience === "client" ? CLIENT_STATUS_LABELS[status] : TRIP_STATUS_LABELS[status]}</Pill>;
}

export function QuoteStatusPill({ status }: { status: QuoteStatus }) {
  const tone: Tone = status === "pending_review" ? "warn" : status === "approved" ? "ok" : ["rejected", "withdrawn", "expired", "replaced"].includes(status) ? "neutral" : status === "booked" ? "ok" : "info";
  return <Pill tone={tone}>{QUOTE_STATUS_LABELS[status]}</Pill>;
}

// Spec s5: every quote shows whether it arrived automatically or was typed in.
export function QuoteSourcePill({ source, model }: { source: QuoteSource; model?: string | null }) {
  const manual = source === "manual";
  return (
    <Pill tone={manual ? "neutral" : "accent"}>
      {manual ? "Manual entry" : model ? `${QUOTE_SOURCE_LABELS[source]} · AI read` : QUOTE_SOURCE_LABELS[source]}
    </Pill>
  );
}

export function PaymentStatusPill({ status }: { status: TripPaymentStatus }) {
  const tone: Tone = status === "verified" ? "ok" : status === "failed" ? "bad" : status === "submitted" || status === "received" ? "warn" : "neutral";
  return <Pill tone={tone}>{PAYMENT_STATUS_LABELS[status]}</Pill>;
}
