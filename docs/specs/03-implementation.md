# Implementation notes: broker-assisted trip workflow

How `01-workflow-summary.md` and `02-technical-blueprint.md` map onto the code.
Started 2026-09-29.

## Decisions (2026-09-29)

- **Web first, then mobile.** The whole flow ships on web (client pages at
  `/request` and `/trips`, broker desk at `/desk`). Client screens are ported to
  the Expo app once the flow is proven. Shared domain code lives in
  `packages/shared/src/trips.ts` so mobile reuses statuses, labels, pricing and
  time-zone helpers.
- **Marketplace hidden, not deleted.** Charter listings, crew hire and aircraft
  sales are removed from client navigation; routes and data stay.
- **Payments are manual in Phase 1.** The client picks card / ACH / wire /
  direct deposit, sees the company's instructions, reports the payment with a
  reference and optional proof upload; finance verifies. No card data is ever
  stored. `trip_payments.processor` exists for a later Stripe (or other)
  integration.
- **Markup is a flat default (10%)**, admin-configurable, with a minimum
  (5%) that only admins can go below, and an admin-only final-price override.
  This replaces the 0017 tiered value/preferred/premium model.
- **E-signature is click-to-sign in Phase 1** (typed name, timestamp, IP, user
  agent, SHA-256 of the exact rendered contract). The blueprint prefers a
  provider; `trip_contracts.signature_provider` / `provider_envelope_id` are
  there to switch to Dropbox Sign or DocuSign without changing the flow.
- **Placeholder content until the company supplies it:** contract template
  (v1 placeholder, publish theirs as v2), cancellation policy, payment
  instructions / bank details, company legal name and address. All editable in
  `/desk/settings`.

## Data model (migrations 0018-0020)

| Spec record | Table(s) |
|---|---|
| USERS / roles | `profiles`, `user_roles` (+ `broker`, `finance` roles); helpers `is_broker()`, `is_finance()`, `is_staff()` |
| CLIENT | `clients` (may exist without an account; linked by verified email) |
| TRIP | `trips` (`trip_number` TRIP-YYYY-NNNNNN, 23-value `trip_status`) |
| timeline | `trip_events` (status changes written by trigger) |
| OPERATOR | `operators` + `network_status` (prospect / approved / preferred / excluded / inactive), integration flags, priority |
| AIRCRAFT | `operator_aircraft` |
| QUOTE | `trip_quotes` (source api/email/website/manual/ai_extracted; cost breakdown; client price; option rank) |
| operator confirmation | `operator_bookings` |
| CONTRACT | `contract_templates` (versioned, frozen once active), `trip_contracts` (immutable once sent) |
| PAYMENT | `trip_payments` (client), `operator_payments` (separate) |
| ITINERARY | `operator_itineraries`, `client_itineraries` (versioned, one published) |
| AOG | `trip_issues` |
| NOTIFICATION | `notifications` (app / email / sms / push rows) |
| FEEDBACK | `trip_feedback` |
| AUDIT | `audit_logs` + `old_value` / `new_value` |
| settings | `app_settings` (pricing, search, automation, company, payment_instructions, cancellation_policy) |

Clients can never read operator cost or markup: `trip_quotes` is
column-granted, and all client writes go through security-definer functions
(`create_trip_request`, `select_trip_option`, `sign_trip_contract`,
`submit_trip_payment`, `submit_trip_feedback`).

## Status machine

```
new_request -> searching -> quotes_received -> broker_review -> options_sent
  -> client_selected -> contract_sent -> contract_signed -> payment_pending
  -> payment_received -> operator_confirmation_pending -> confirmed
  -> itinerary_pending -> itinerary_ready -> within_72_hours -> active
  -> completed -> feedback_requested -> closed
exception: (confirmed..active) -> operational_issue -> replacement_search
  -> replacement_pending_client -> client_selected -> operator_confirmation_pending
  -> itinerary_pending (new itinerary version) -> ...
any open status -> cancelled
```

Every transition lives in `apps/web/lib/trips/workflow.ts` (staff) or the
client RPCs in 0019. Time-driven transitions (72-hour reminder, active,
auto-close) run in `/api/cron/trips`.

## Where things are

- Domain constants, pricing engine, time zones: `packages/shared/src/trips.ts`
- Workflow + guards + audit + notifications: `apps/web/lib/trips/`
- AI (request parser, RFQ drafting, reply classification, quote normalizer,
  confirmation drafting): `apps/web/lib/sourcing/claude.ts`; orchestration in
  `engine.ts`; operator search in `match.ts`
- Inbound email (operator replies, client requests, operator AOG notices):
  `/api/rfq/inbound`
- Client pages: `/request`, `/trips`, `/trips/[id]` (+ `/contract`, `/pay`,
  `/itinerary`)
- Broker desk: `/desk` (dashboard), `/desk/trips/[id]` (workspace),
  `/desk/payments`, `/desk/clients`, `/desk/operators`, `/desk/inbox`,
  `/desk/feedback`, `/desk/settings`

## Phase status vs the spec's Phase 1 (MVP) list

Client questionnaire, trip creation, broker dashboard, operator database, manual
quote entry, AI-assisted quote organization (three-option engine), 10% markup,
3-option presentation, client selection, contract generation/signature,
payment status, operator confirmation, itinerary upload, client trip
dashboard, 72-hour reminder, feedback: built in this pass.

Phase 2 items already present from the earlier sourcing engine: operator email
RFQs, AI quote extraction, AI operator search, AI replacement search (a new RFQ
round on an operational issue), email request parsing.

Not built yet: SMS and push delivery (rows are recorded), live flight tracking
provider (ADS-B positions exist for sourcing only), branded PDF generation
(itinerary and contract are print-ready pages; browsers save them as PDF),
Stripe card processing, operator APIs, analytics/CRM.
