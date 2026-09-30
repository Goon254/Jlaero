import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CalendarClock, Check, FileSignature, FileText, Plane, Radar, Users } from "lucide-react";
import {
  AIRCRAFT_CATEGORY_LABELS, CLIENT_STAGES, CLIENT_STATUS_LABELS, clientStageIndex, FEEDBACK_CATEGORIES, formatLocal,
  PAYMENT_STATUS_LABELS, type AircraftCategory, type TripPaymentStatus, type TripStatus,
} from "@jlaero/shared";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/lux/ActionForm";
import { ClientShell } from "@/components/lux/ClientShell";
import { PaymentStatusPill, TripStatusPill } from "@/components/lux/status";
import { ButtonLink, Card, cx, DefinitionList, Eyebrow, Money, Notice, Pill, SectionTitle, Textarea } from "@/components/lux/ui";
import { selectOption, submitFeedback } from "../_lib/actions";
import { CLIENT_NEXT } from "../_lib/copy";
import { Countdown } from "../_lib/Countdown";
import { airportCode, airportLabel, loadClientSettings, loadTrip, OPTION_COLUMNS, type Airport, type ClientOption } from "../_lib/data";
import { StarRating } from "../_lib/fields";

export const metadata = { title: "Your trip | Jlaero" };

const FINISHED: TripStatus[] = ["completed", "feedback_requested", "closed", "cancelled"];
const COUNTDOWN_FROM: TripStatus[] = ["payment_received", "operator_confirmation_pending", "confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours", "active", "operational_issue", "replacement_search", "replacement_pending_client"];

type Event = { id: string; kind: string; to_status: TripStatus | null; message: string | null; created_at: string };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${id}`);
  const loaded = await loadTrip(id);
  if (!loaded) notFound();
  const { trip, origin, destination } = loaded;
  const supabase = await createClient();

  const [optionsRes, contractRes, paymentsRes, itineraryRes, eventsRes, feedbackRes, settings] = await Promise.all([
    supabase.from("trip_quotes").select(OPTION_COLUMNS).eq("trip_id", id).order("option_rank"),
    supabase.from("trip_contracts").select("id, contract_number, status, signed_at").eq("trip_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("trip_payments").select("id, amount, currency, status, method, submitted_at, verified_at, failure_reason").eq("trip_id", id).order("created_at", { ascending: false }),
    supabase.from("client_itineraries").select("id, version, published_at").eq("trip_id", id).eq("status", "published").maybeSingle(),
    supabase.from("trip_events").select("id, kind, to_status, message, created_at").eq("trip_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("trip_feedback").select("rating, comments, created_at").eq("trip_id", id).maybeSingle(),
    loadClientSettings(),
  ]);
  const options = (optionsRes.data ?? []) as ClientOption[];
  const contract = contractRes.data?.[0] ?? null;
  const payments = paymentsRes.data ?? [];
  const itinerary = itineraryRes.data;
  const events = (eventsRes.data ?? []) as Event[];
  const feedback = feedbackRes.data;

  const status = trip.status;
  const replacementChoice = status === "replacement_pending_client";
  const choosing = status === "options_sent" || replacementChoice;
  const openOptions = options.filter((o) => o.status === "option_sent" && o.is_replacement === replacementChoice);
  const selected = options.find((o) => o.id === trip.selected_quote_id) ?? null;
  const stage = clientStageIndex(status);
  const hoursOut = (new Date(trip.depart_at).getTime() - Date.now()) / 3600000;
  const showCountdown = hoursOut <= 72 && hoursOut > -12 && COUNTDOWN_FROM.includes(status);
  const payment = payments[0] ?? null;
  const fmt = (iso: string, a: Airport | null) => formatLocal(iso, a?.tz, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const o = airportCode(origin, trip.origin_icao);
  const d = airportCode(destination, trip.destination_icao);

  return (
    <ClientShell>
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-fg-3">
        <Link href="/trips" className="hover:text-fg">My trips</Link> <span aria-hidden>/</span> <span className="text-fg-2">{trip.trip_number}</span>
      </nav>

      <header className="mb-8">
        <Eyebrow className="mb-2">{trip.trip_number}</Eyebrow>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {o} <span className="text-fg-3">to</span> {d}
        </h1>
        <p className="mt-2 text-fg-2">{fmt(trip.depart_at, origin)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TripStatusPill status={status} audience="client" />
          {trip.return_at && <Pill>Round trip</Pill>}
        </div>
      </header>

      {status !== "cancelled" && <StageTracker current={stage} done={FINISHED.includes(status)} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {status === "cancelled" ? (
            <Notice tone="neutral" title="This trip was cancelled">{trip.cancel_reason ?? "Contact your broker if you have questions."}</Notice>
          ) : (
            <NextStep status={status} tripId={id} paymentStatus={payment?.status as TripPaymentStatus | undefined} />
          )}

          {choosing && (
            <section aria-labelledby="options-h">
              <SectionTitle>
                <span id="options-h">{replacementChoice ? "Replacement aircraft options" : "Your charter options"}</span>
              </SectionTitle>
              <p className="mb-4 text-sm text-fg-2">
                Prices are estimates until your broker and the operator verify availability and pricing. Your trip is confirmed only after your agreement is signed and payment is received and verified.
              </p>
              {openOptions.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {openOptions.map((opt) => (
                    <OptionCard key={opt.id} option={opt} tripId={id} route={`${o} to ${d}`} />
                  ))}
                </div>
              ) : (
                <Notice tone="warn" title="These options have expired">Your broker has been notified and will send refreshed options.</Notice>
              )}
            </section>
          )}

          {selected && !choosing && (
            <Card>
              <Eyebrow className="mb-3">Your aircraft</Eyebrow>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-2xl font-semibold">{selected.headline || selected.aircraft_type}</p>
                  <p className="mt-1 text-sm text-fg-2">
                    {[selected.aircraft_category ? AIRCRAFT_CATEGORY_LABELS[selected.aircraft_category as AircraftCategory] : null, selected.passenger_capacity ? `Up to ${selected.passenger_capacity} passengers` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-fg-3">{["client_selected", "contract_sent"].includes(status) ? "Estimated total" : "Total"}</p>
                  <p className="font-display text-2xl font-semibold"><Money value={selected.client_price} currency={selected.currency} /></p>
                </div>
              </div>
            </Card>
          )}

          {showCountdown && (
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <Eyebrow>Your trip</Eyebrow>
                <CalendarClock className="h-5 w-5 text-fg-3" aria-hidden />
              </div>
              <p className="font-medium">{airportLabel(origin, trip.origin_icao)} to {airportLabel(destination, trip.destination_icao)}</p>
              <p className="mb-5 text-sm text-fg-2">Departure {fmt(trip.depart_at, origin)}</p>
              <Countdown departAt={trip.depart_at} />
              <details className="mt-6 rounded-xl border border-line bg-raised px-4 py-3">
                <summary className="min-h-[28px] cursor-pointer text-sm font-semibold">Review cancellation policy</summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-2">{settings.cancellation_policy.body || "Your cancellation terms are set out in your charter agreement."}</p>
              </details>
            </Card>
          )}

          {status === "active" && <TrackingCard aircraft={selected?.headline || selected?.aircraft_type || "Your aircraft"} origin={origin} destination={destination} trip={trip} fmt={fmt} />}

          {(status === "completed" || status === "feedback_requested" || status === "closed") && (
            <Card id="feedback">
              <Eyebrow className="mb-2">Thank you</Eyebrow>
              <p className="font-display text-2xl font-semibold">Thank you for flying with us.</p>
              <p className="mt-2 text-fg-2">We appreciate the opportunity to assist with your trip.</p>
              {feedback ? (
                <div className="mt-6 rounded-xl bg-raised p-4">
                  <p className="text-sm font-semibold">Your rating: {feedback.rating} of 5</p>
                  {feedback.comments && <p className="mt-2 text-sm text-fg-2">{feedback.comments}</p>}
                </div>
              ) : status !== "closed" ? (
                <div className="mt-6">
                  <ActionForm action={submitFeedback.bind(null, id)} submitLabel="Send feedback">
                    <StarRating name="rating" legend="How would you rate your trip?" required />
                    <div>
                      <label htmlFor="comments" className="mb-1.5 block text-sm font-medium">What did you think about your experience?</label>
                      <Textarea id="comments" name="comments" rows={4} />
                    </div>
                    <details className="rounded-xl border border-line px-4 py-3">
                      <summary className="min-h-[28px] cursor-pointer text-sm font-semibold">Rate specific parts of your trip (optional)</summary>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {FEEDBACK_CATEGORIES.map(([key, label]) => <StarRating key={key} name={`cat_${key}`} legend={label} size="sm" />)}
                      </div>
                    </details>
                  </ActionForm>
                </div>
              ) : null}
            </Card>
          )}

          <Card>
            <SectionTitle>Trip details</SectionTitle>
            <DefinitionList
              items={[
                ["From", `${airportLabel(origin, trip.origin_icao)} (${o})`],
                ["To", `${airportLabel(destination, trip.destination_icao)} (${d})`],
                ["Departure", fmt(trip.depart_at, origin)],
                ["Return", trip.return_at ? fmt(trip.return_at, destination) : "One way"],
                ["Passengers", String(trip.passengers)],
                ["Aircraft requested", trip.aircraft_preference || (trip.aircraft_category ? AIRCRAFT_CATEGORY_LABELS[trip.aircraft_category as AircraftCategory] : "Broker recommendation")],
                ["Vehicle service", trip.vehicle_required ? "Yes" : "No"],
                ["Catering", trip.catering_required ? "Yes" : "No"],
              ]}
            />
            {trip.special_requests && (
              <div className="mt-4">
                <p className="text-sm text-fg-2">Special requests</p>
                <p className="mt-1 whitespace-pre-line text-sm">{trip.special_requests}</p>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {contract && (
            <Card>
              <div className="flex items-center gap-3">
                <FileSignature className="h-5 w-5 text-fg-3" aria-hidden />
                <p className="font-semibold">Charter agreement</p>
              </div>
              <p className="mt-2 text-sm text-fg-2">
                {contract.status === "signed" ? `Signed ${new Date(contract.signed_at!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : contract.status === "sent" ? "Ready for your signature" : "Replaced by a newer version"}
              </p>
              <Link href={`/trips/${id}/contract`} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-accent-text hover:underline">
                View agreement <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Card>
          )}
          {payment && (
            <Card>
              <p className="font-semibold">Payment</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Money value={payment.amount} currency={payment.currency} className="font-display text-xl font-semibold" />
                <PaymentStatusPill status={payment.status as TripPaymentStatus} />
              </div>
              {payment.status === "failed" && payment.failure_reason && <p className="mt-2 text-sm text-bad">{payment.failure_reason}</p>}
              <Link href={`/trips/${id}/pay`} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-accent-text hover:underline">
                {["pending", "failed"].includes(payment.status) ? "Make payment" : "Payment details"} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Card>
          )}
          {itinerary && (
            <Card>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-fg-3" aria-hidden />
                <p className="font-semibold">Itinerary</p>
                {itinerary.version > 1 && <Pill tone="info">Updated</Pill>}
              </div>
              <Link href={`/trips/${id}/itinerary`} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-accent-text hover:underline">
                View itinerary <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Card>
          )}
          <Card>
            <p className="mb-3 font-semibold">Activity</p>
            {events.length ? (
              <ol className="space-y-4">
                {events.map((e) => (
                  <li key={e.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden />
                    <p className="text-sm">{e.kind === "status" && e.to_status ? (e.message === "Trip created" ? "Request received" : CLIENT_STATUS_LABELS[e.to_status]) : e.message}</p>
                    <p className="text-xs text-fg-3">{new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-fg-3">Updates will appear here.</p>
            )}
          </Card>
          {settings.company.support_email || settings.company.support_phone ? (
            <Card>
              <p className="font-semibold">Your charter desk</p>
              <p className="mt-2 text-sm text-fg-2">
                {settings.company.support_phone && <><a className="hover:underline" href={`tel:${settings.company.support_phone}`}>{settings.company.support_phone}</a><br /></>}
                {settings.company.support_email && <a className="hover:underline" href={`mailto:${settings.company.support_email}?subject=${encodeURIComponent(trip.trip_number)}`}>{settings.company.support_email}</a>}
              </p>
            </Card>
          ) : null}
        </aside>
      </div>
    </ClientShell>
  );
}

function StageTracker({ current, done }: { current: number; done: boolean }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Trip progress">
      {CLIENT_STAGES.map((label, i) => {
        const complete = done || i < current;
        const active = !done && i === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined}>
            <div className={cx("h-1.5 rounded-full", complete ? "bg-fg" : active ? "bg-accent" : "bg-line")} />
            <p className={cx("mt-2 flex items-center gap-1 text-xs sm:text-sm", complete || active ? "font-semibold text-fg" : "text-fg-3")}>
              {complete && <Check className="h-3.5 w-3.5" aria-hidden />}
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function NextStep({ status, tripId, paymentStatus }: { status: TripStatus; tripId: string; paymentStatus?: TripPaymentStatus }) {
  const text = CLIENT_NEXT[status];
  let action: React.ReactNode = null;
  if (status === "contract_sent") action = <ButtonLink href={`/trips/${tripId}/contract`}>Review and sign</ButtonLink>;
  if (status === "payment_pending" || status === "contract_signed") {
    action = paymentStatus === "submitted" || paymentStatus === "received"
      ? <p className="text-sm text-fg-2">Payment {PAYMENT_STATUS_LABELS[paymentStatus].toLowerCase()}. Your broker will verify it shortly.</p>
      : <ButtonLink href={`/trips/${tripId}/pay`}>Make payment</ButtonLink>;
  }
  if (status === "feedback_requested") action = <ButtonLink href="#feedback" variant="secondary">Leave feedback</ButtonLink>;
  if (!text) return null;
  const tone = ["operational_issue", "replacement_search"].includes(status) ? "warn" : "accent";
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4", tone === "warn" ? "border-warn/40 bg-warn-soft" : "border-accent/40 bg-accent-soft")}>
      <div>
        <p className="font-display text-lg font-semibold">{CLIENT_STATUS_LABELS[status]}</p>
        <p className="text-sm text-fg-2">{text}</p>
        {["client_selected", "contract_sent", "payment_pending", "contract_signed"].includes(status) && (
          <p className="mt-1 text-xs text-fg-3">Your trip is confirmed only after payment is received and verified.</p>
        )}
      </div>
      {action}
    </div>
  );
}

function OptionCard({ option, tripId, route }: { option: ClientOption; tripId: string; route: string }) {
  const expires = option.expires_at ? new Date(option.expires_at) : null;
  return (
    <Card className="flex flex-col">
      <Eyebrow>Option {option.option_rank ?? ""}</Eyebrow>
      <p className="mt-2 font-display text-xl font-semibold leading-snug">{option.headline || option.aircraft_type}</p>
      {option.headline && option.headline !== option.aircraft_type && <p className="text-sm text-fg-2">{option.aircraft_type}</p>}
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2"><Plane className="h-4 w-4 text-fg-3" aria-hidden /><dt className="sr-only">Aircraft class</dt><dd>{option.aircraft_category ? AIRCRAFT_CATEGORY_LABELS[option.aircraft_category as AircraftCategory] : "Private jet"}{option.year_mfr ? `, ${option.year_mfr}` : ""}</dd></div>
        {option.passenger_capacity && <div className="flex items-center gap-2"><Users className="h-4 w-4 text-fg-3" aria-hidden /><dt className="sr-only">Passengers</dt><dd>Up to {option.passenger_capacity} passengers</dd></div>}
        <div className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-fg-3" aria-hidden /><dt className="sr-only">Route</dt><dd>{route}</dd></div>
      </dl>
      {option.highlights?.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-fg-2">
          {option.highlights.map((h) => (
            <li key={h} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{h}</li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-6">
        <p className="text-xs text-fg-3">Estimated price</p>
        <p className="font-display text-3xl font-semibold"><Money value={option.client_price} currency={option.currency} /></p>
        {expires && <p className="mt-1 text-xs text-fg-3">Held until {expires.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
        <div className="mt-4">
          <ActionForm
            action={selectOption.bind(null, tripId, option.id)}
            submitLabel="Select This Aircraft"
            pendingLabel="Sending..."
            submitClassName="w-full"
            confirm={`Select ${option.headline || option.aircraft_type}? Your broker will verify availability and send your agreement.`}
          />
        </div>
      </div>
    </Card>
  );
}

// Spec s16: tracking panel. No provider is connected yet, so it shows the
// schedule and says plainly that live position is not available.
function TrackingCard({ aircraft, origin, destination, trip, fmt }: {
  aircraft: string; origin: Airport | null; destination: Airport | null;
  trip: { origin_icao: string; destination_icao: string; depart_at: string }; fmt: (iso: string, a: Airport | null) => string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Eyebrow>Live trip tracking</Eyebrow>
        <Radar className="h-5 w-5 text-fg-3" aria-hidden />
      </div>
      <DefinitionList
        items={[
          ["Aircraft", aircraft],
          ["Departure", `${airportLabel(origin, trip.origin_icao)}, ${fmt(trip.depart_at, origin)}`],
          ["Destination", airportLabel(destination, trip.destination_icao)],
          ["Flight status", <Pill key="s" tone="ok">In progress</Pill>],
        ]}
      />
      <p className="mt-4 text-xs text-fg-3">Live position and estimated arrival will appear here once flight tracking is connected for your aircraft.</p>
    </Card>
  );
}
