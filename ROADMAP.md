# Jlaero Roadmap v2: every page, every screen, to live

The build-following document. We work top to bottom by phase. A phase is done
when its "Done when" line is true.

Governing principle after the domain review: **model deep, UI shallow.** The
database schema captures the real charter domain (legs, line-item quotes,
contracts, deposits, document expiry) from the start, because retrofitting
those reworks everything. The v1 UI exposes a deliberately simple slice.

Status legend: [x] done, [~] in progress, [ ] not started

---

## 1. Web page inventory

### 1.1 Public (no login)

| # | Route | Page | Notes |
|---|-------|------|-------|
| P1 | `/` | Landing | [x] basic version. Hero, marketplace cards, how it works, trust blurb |
| P2 | `/charter` | Charter search | Origin/dates/pax search, filters (category, seats, price, safety rating), sort control, result cards, empty-state with lead capture |
| P3 | `/charter/[id]` | Aircraft detail | Gallery (full-screen), specs, safety ratings, verified-operator badge, cancellation policy block, operator profile link, availability, "Request quote" CTA, similar aircraft, report listing |
| P4 | `/crew` | Crew browse | Filter by role, base, rate; verified badge |
| P5 | `/crew/[id]` | Crew detail | Licenses, ratings, hours, rate, reviews, hire CTA |
| P6 | `/marketplace` | Aircraft for sale | Filters; explicit "inquiry only, no escrow" notice |
| P7 | `/marketplace/[id]` | Sale detail | Gallery, specs, seller card, inquiry form |
| P8 | `/login` | Sign in / sign up | [x] done |
| P8b | `/forgot-password` + `/reset-password` | Password reset | Required before launch |
| P8c | `/verify-email` | Email verification | "Check your inbox" + resend button; where confirm links land |
| P9 | `/list` | List with Jlaero | Owner/crew pitch page |
| P10 | `/operators/[id]` | Operator public profile | Indexable trust page: fleet, ratings, verification tier |
| P11 | `/about`, `/contact` | About / Contact | |
| P12 | `/terms`, `/privacy` | Legal | Store-approval requirement; lawyer pass per 3c |
| P13 | `/routes/[origin]-to-[destination]` | Programmatic route pages | Primary SEO channel in this industry ("private jet charter New York to Miami"). Generated from airports table + structured data markup. Phase 8 |
| P14 | `/help` | Help / FAQ | Static v1 |
| P15 | 404 + 500 pages | Error pages | Branded, with recovery links |

### 1.2 Authenticated (any role)

| # | Route | Page | Notes |
|---|-------|------|-------|
| A1 | `/onboarding` | Onboarding | [x] done |
| A2 | `/dashboard` | Dashboard | [x] basic. Role context switcher lives in the header app-wide (traveler/owner/crew views) |
| A3 | `/bookings` | My bookings | Buyer AND provider tabs, status chips, expiry countdowns |
| A4 | `/bookings/[id]` | Booking detail | State timeline, itinerary legs, passenger manifest editor, quote card (line items + taxes), contract review/sign step, pay (deposit/balance), cancel with refund preview, dispute entry, receipt/invoice PDF, add-to-calendar, embedded chat |
| A5 | `/messages` | Inbox | Unread badges |
| A6 | `/messages/[id]` | Conversation | Realtime; quote cards render inline; block/report user |
| A7 | `/settings` | Profile | Name, avatar, phone, company; change email (with re-verify); change password; sign out all devices |
| A8 | `/settings/verification` | Verification | Per-doc status, rejection reasons, resubmission, expiry warnings |
| A9 | `/settings/payments` | Payments | Payment methods, Stripe Connect state, payout account |
| A10 | `/settings/notifications` | Notification preferences | Per-channel toggles; unsubscribe compliance |
| A11 | `/settings/delete-account` | Account deletion | Store requirement. Anonymize, keep counterparty history; blocked while a booking is active |
| A12 | `/favorites` | Saved listings | Aircraft/crew/sale favorites |

Suspended accounts: any authenticated page renders a suspension notice with a
support contact instead of content.

### 1.3 Owner (role: owner)

| # | Route | Page | Notes |
|---|-------|------|-------|
| O1 | `/owner` | Owner dashboard | Listings, pending requests, earnings snapshot |
| O2 | `/owner/aircraft` | My aircraft | Status cards, duplicate-listing action |
| O3 | `/owner/aircraft/new` + edit | Aircraft form | Multi-step with draft autosave, photo reorder, preview-as-buyer, completeness meter. Fields include tail number, category, seats, range, min runway, safety ratings, hourly rate, daily minimum, cancellation policy tier, instant-book opt-in |
| O5 | `/owner/aircraft/[id]/availability` | Availability | Calendar: blocked ranges + maintenance blocks (distinct type), recurring blocks v2 |
| O6 | `/owner/requests` | Requests | Accept / send quote (line-item builder) / counter / decline, expiry countdown |
| O7 | `/owner/sales` + new/edit | Sale listings | Mark under offer / sold |
| O9 | `/owner/earnings` | Earnings | Pending balance, payout history, failed-payout state, Stripe restricted-account warnings |
| O10 | `/owner/documents` | Aircraft + operator docs | Part 135 cert (number, expiry), insurance (liability limit, expiry), registration, airworthiness; expiry countdowns |

### 1.4 Crew (role: crew)

| # | Route | Page | Notes |
|---|-------|------|-------|
| C1 | `/crew/me` | My crew profile | Licenses + medical (class, expiry), type ratings, hours, rate, bio |
| C2 | `/crew/me/availability` | Availability | Same calendar component as O5 |
| C3 | `/crew/requests` | Hire requests | Accept / quote / decline |

### 1.5 Admin (role: admin)

| # | Route | Page | Notes |
|---|-------|------|-------|
| AD1 | `/admin` | Overview | Users, listings, bookings, revenue, pending verifications |
| AD2 | `/admin/verifications` | Verification queue | Per-doc approve/reject with reason, reviewer notes history, expiry-driven re-verification queue |
| AD3 | `/admin/users` | Users | Search, suspend, grant roles |
| AD4 | `/admin/listings` | Moderation | Approve/hide; user-report queue feeds here |
| AD5 | `/admin/bookings` | Bookings + disputes | Any booking, refund/payout override (audited) |
| AD6 | `/admin/audit` | Audit log | Every admin action: who, what, when. Non-negotiable once money moves |

---

## 2. Mobile screens (Expo: iOS + Android)

Tabs: **Explore, Bookings, Messages, Account.** Mobile v1 = booking, chat,
request handling. Heavy listing management stays web-first.

| # | Screen | Notes |
|---|--------|-------|
| M1 | Welcome / auth + password reset | Email/password only in v1 |
| M2 | Onboarding | |
| M3 | Charter search + filters | |
| M4 | Aircraft detail + request | |
| M5 | Crew browse/detail/hire | |
| M6 | Marketplace browse/detail/inquire | |
| M7 | Bookings list | Buyer + provider |
| M8 | Booking detail | Timeline, sign contract, pay (Stripe; charter is a physical service so Apple IAP does not apply), cancel w/ refund preview |
| M9 | Messages inbox | |
| M10 | Conversation | Realtime + quote cards |
| M11 | Requests inbox (providers) | Accept / quote / decline |
| M12 | Account | Profile, roles, verification, notification prefs, delete account |
| M13 | Verification upload | Camera/picker |
| M14 | Push + deep links | Notification opens the exact booking/conversation |

Platform mechanics (Phase 9 checklist): permissions priming screens before OS
prompts (camera, photos, notifications), offline/poor-connectivity states
(people book from airports), force-update gate via a min-version config check,
EAS Update for OTA JS fixes (native changes still need store review), Sentry
for crash reporting, demo mode considerations for store reviewers.

---

## 3. System work

| # | Item | Notes |
|---|------|-------|
| S1 | Booking engine | Server-side transitions enforcing the state machine AND an actor matrix (who may perform each transition); server derives provider_id; holds and expiries via scheduled jobs (pg_cron) [ ] |
| S2 | Conversations per booking | Auto-create on request [ ] |
| S3 | Realtime messaging | Supabase Realtime [ ] |
| S4 | Photo upload pipeline | Storage buckets, ordering, resize [ ] |
| S5 | Payments (Stripe) | Connect Express onboarding. Separate charges and transfers: deposit and/or balance charged to platform, transfer to provider minus fee AFTER completion + hold window. Card + **ACH debit** (async: pending state, settles in days, webhook-driven). Wire = v2 manual reconciliation. Refund engine tied to policy tiers incl. partial refunds. Dispute/chargeback webhooks. Failed payout handling. Invoices + receipts as PDFs. 1099s via Stripe [ ] |
| S6 | Transactional email | Template inventory per notification matrix (3e); Resend [ ] |
| S7 | Push notifications | Expo tokens table, booking + message events [ ] |
| S8 | Search v1 | Origin (home_base match or within N km), dates vs availability, seats, category, price, safety rating. **Feasibility filter:** hide aircraft whose range < trip distance or min-runway > destination runway (when data present). No multi-leg routing [ ] |
| S9 | Admin tooling + audit log | Every admin mutation writes audit_logs [ ] |
| S10 | Generated DB types | Replace placeholder [ ] |
| S11 | Tests | State machine + actor matrix unit tests, RLS tests, quote math (incl. FET) tests, booking flow integration [ ] |
| S12 | CI | GitHub Actions: typecheck, build, tests [ ] |
| S13 | Seed script | Demo aircraft/crew/sales/bookings [ ] |
| S14 | Analytics | PostHog [ ] |
| S15 | Error tracking | Sentry web + mobile [ ] |
| S16 | Airports reference | OurAirports import: ICAO/IATA, name, city, coords, timezone, longest runway. Powers autocomplete ("JFK"/"KJFK"/"New York" resolve), near-me, distance, feasibility, airport-local times, route SEO pages [ ] |
| S17 | Account deletion | Anonymize PII, preserve counterparty bookings/reviews, delete auth user; blocked during active bookings [ ] |
| S18 | Prod/dev split | Second Supabase project for prod before launch [ ] |
| S19 | Quote engine | Line-item quotes (flight time, positioning, daily minimum, fees, catering, surcharges) + US FET 7.5% + per-segment tax as computed lines; quote versions; accepted version frozen on the booking [ ] |
| S20 | Contracts | Charter agreement generated per booking (platform template v1), click-to-sign (name + timestamp + IP), stored PDF; contract states gate payment [ ] |
| S21 | Document expiry engine | expires_at on all credential docs; reminders at 30/7 days; auto-suspend listing when a required doc lapses [ ] |
| S22 | Feature flags | Simple flags table; kill switch for instant book [ ] |
| S23 | Reports/moderation intake | Users report listings/messages; feeds AD4 [ ] |

---

## 3b. Charter domain model (the deep part)

**Itineraries are legs.** `bookings` -> `booking_legs` (origin, destination,
depart local time + airport tz, pax per leg). One-way = 1 leg, round trip = 2.
The v1 UI builder offers one-way and round trip only; the model supports
multi-leg so the UI can grow without rework. Search, quoting, and the
availability check all read legs, never a flat origin/destination pair.

**Passenger manifest.** `booking_passengers` (full name, DOB, optional weight,
notes). Editable on A4/M8 until departure. Required before contract signing.

**FBO capture.** Optional free-text FBO per leg in v1 (structured `fbos` table
is v2). Special requests: catering, ground transport, pets, luggage notes as
structured fields on the booking.

**Quotes are documents.** `quotes` (versioned per booking, expires_at default
72h) -> `quote_line_items` (kind: flight_time, positioning, daily_minimum,
landing_fees, crew_overnight, catering, fuel_surcharge, discount, tax_fet,
tax_segment, other). The accepted quote version is immutable and referenced by
the payment. Counter-offers = new quote versions from either side.

**Pricing inputs on the listing:** hourly rate, daily minimum hours, overnight
crew fee, positioning treatment (included / billed). Instant book computes:
estimated hours per leg (great-circle / category cruise speed) x hourly rate
+ minimums, + taxes. Owner opt-in, capped by a price ceiling (open decision)
above which it falls back to request/quote. Kill switch via S22.

**Positioning reality note:** the aircraft is rarely at the departure airport.
v1 keeps it simple: owners either include positioning in the hourly price or
add a positioning line item on the quote. Automatic ferry calculation is v2.

**Availability + conflicts:** available unless blocked (owner block or
maintenance block) or covered by an accepted/deposit_paid/paid booking.
Exclusion constraint on aircraft_id + occupied date range makes double
acceptance impossible; UI checks before, constraint guarantees.
Accepting a quote places a hold; unpaid holds auto-expire (default 24h).

**State machine v2:**

```
requested -> quoted -> negotiating -> accepted -> contract_signed
   -> deposit_paid -> paid_in_full -> in_progress -> completed -> (reviewed)
```

Additional terminal/branch states: `expired` (request or quote or hold),
`declined`, `cancelled` (with cancelled_by: buyer|provider|platform and
reason: standard|weather|mechanical|other; refunds keyed off actor + reason +
policy tier), `disputed`, `refunded`. Every transition has an allowed-actor
rule enforced server-side (S1). Weather/mechanical cancellation by provider =
full refund, no penalty flag.

**Cancellation policies are per listing,** chosen from platform-defined tiers
(Flexible / Moderate / Strict, exact percentages an open decision), displayed
on P3 and before payment, enforced by the refund engine.

**Post-confirmation flight info:** after contract_signed the owner supplies
tail number and crew names on the booking; shown to the buyer with a flight
tracking link (external, by tail number). Lightweight but expected.

**Crew bookings** reuse bookings + legs (single "leg" = engagement location and
period). No manifest, no FET.

## 3c. Regulatory, trust, and compliance

- **Broker of record vs neutral marketplace: OPEN DECISION, needs a lawyer.**
  US DOT (14 CFR Part 295) imposes disclosure rules on air charter brokers.
  This choice drives required disclosures, the contract template, insurance,
  and tax handling. Must be settled before Phase 8 launch; build proceeds on
  the marketplace model meanwhile.
- **Part 135 gating:** active charter listings require an approved operator
  certificate before public launch. Dev environment exempt.
- **Verification tiers, not one badge:** identity-verified, operator-verified
  (cert + ops specs + areas of operation), insurance-verified (with liability
  limit as a searchable listing field). Crew: license + medical class/expiry,
  hours, time on type.
- **Aircraft-level documents:** registration/tail, airworthiness, insurance
  certificate. All docs carry expiry (S21) with auto-suspension.
- **Safety ratings:** ARGUS / Wyvern / IS-BAO as listing fields, filterable,
  displayed as badges. Self-declared at v1, verified against the rating body
  during operator verification.
- **US Federal Excise Tax:** 7.5% + per-segment fee on domestic charter,
  modeled as quote line items from day one (S19). International: operator
  quotes tax-inclusive in v1.
- **Fee incidence:** who bears the 10% (buyer, seller, split) is an open
  decision; default assumption seller-side with all-in buyer pricing.
- **AML/sanctions:** rely on Stripe KYC at launch; OFAC screen becomes part of
  the wire-transfer flow when wires arrive (v2). No PEP program in v1.
- **Privacy:** cookie consent, data export on request (manual v1), deletion
  via A11. Age 18+ gating at signup.
- **Disintermediation:** accepted risk in v1; contact info stays out of
  listings, chat opens post-request.

## 3d. Standard page states (applies to every list/detail page, web + mobile)

Every page ships with: loading skeleton, empty state with a next action, error
state with retry, permission-denied state, and pagination (infinite scroll on
mobile, paged on web). This is the definition of "done" for any page in this
document; not repeated per page.

Also standard: responsive breakpoints (mobile-first web), WCAG 2.1 AA
targets, dark theme only in v1 (already the design), shared component library
grows in `apps/web/components` and is mirrored in mobile.

## 3e. Notification matrix (skeleton; filled in during Phase 3-4)

Events x audience x channel (in-app badge, email, push; SMS is v2 for
time-critical departure changes). Every marketing-class email honors
unsubscribe; transactional ignores it. Quiet hours batch non-urgent pushes.

Core events: request received, quote received, quote expiring, accepted,
contract ready, contract signed, payment due, payment received/failed,
booking cancelled, departure reminder, new message, review prompt, document
expiring, payout sent/failed, verification approved/rejected.

---

## 4. Build phases

### Phase 0: Foundation  [x] DONE
Monorepo, schema + hardened RLS, auth, onboarding, dashboard, landing.

### Phase 0.5: Domain schema upgrade (from this review; before any Phase 1 UI)
Migrations: booking_legs, booking_passengers, quotes + quote_line_items,
contracts, cancellation policy tier on listings, pricing fields (daily
minimum, overnight fee, positioning treatment), state machine v2 enums,
document expiry columns, airports table (S16), audit_logs, feature_flags,
favorites, reports, notification_preferences, aircraft docs + safety-rating
fields. Update shared constants + transition/actor matrix + tests (S11 starts
here).
**Done when:** schema and shared types express the full 3b/3c model and the
state machine tests pass.

### Phase 1: Charter supply
O1, O2, O3, O5, O10 + S4 + S13 + airport autocomplete off S16.
**Done when:** an owner creates a listing with photos, docs, pricing fields,
policy tier, and availability, and publishes it.

### Phase 2: Charter demand
P2, P3, P10 + S8 (with feasibility filter).
**Done when:** a visitor searches, sees only feasible aircraft, opens detail,
and submits a request with legs + passengers that reaches the owner.

### Phase 3: Booking engine, quoting, messaging
A3, A4 (minus payment), A5, A6, O6 + S1, S2, S3, S19 + manifest editor +
exclusion constraint + holds/expiries.
**Done when:** request -> line-item quote (with FET) -> counter -> accept ->
hold placed, all with chat, between two real accounts; overlapping
acceptance impossible; expiries fire.

### Phase 4: Contracts + payments
S20 contracts step, then S5: deposit and/or full payment (card + ACH incl.
async pending), refund engine per policy tiers, transfers on completion +
hold window, dispute webhooks, receipts/invoices, O9, A9 + instant book per
3b behind its flag and ceiling.
**Done when:** accepted booking -> signed agreement -> deposit -> balance ->
completion -> provider transfer minus fee; refunds follow tiers; ACH pending
states resolve via webhook; instant book works under the ceiling.

### Phase 5: Reviews, verification, admin
A7, A8, A10, A11, A12 + review UI + S9 (audit log), S17, S21, S22, S23 +
AD1-AD6.
**Done when:** docs upload/expire/re-verify with auto-suspension; admin
approves with an audit trail; completed bookings get two-way reviews;
accounts can be deleted.

### Phase 6: Crew marketplace
P4, P5, C1, C2, C3. Reuses engine, quotes (no FET), contracts optional.
**Done when:** crew publishes, gets booked and paid through the same flow.

### Phase 7: Sales + empty legs
P6, P7, O7 + inquiry -> conversation. Empty legs: empty_legs table, browse
page + cards on P2, books via fixed-price request flow.
**Done when:** a sale inquiry opens a conversation; an empty leg can be
listed and booked at its fixed price.

### Phase 8: Web launch
- P8b, P8c, P9, P11, P12 (lawyer-reviewed per 3c broker decision), P13 route
  SEO pages + structured data, P14, P15
- Verification gating live (Part 135), S6 email per matrix, S14, S15, S11
  full pass, S12 CI green
- S18 prod project; Supabase hygiene (confirmations on, SMTP, rotate DB
  password + the password shared in chat, backups)
- Stripe live keys + webhooks
- **Email first:** migrate support@jlaero.com off cPanel (Google
  Workspace/Zoho), THEN DNS cutover to Vercel; retire old hosting after
- Cookie consent + privacy ops (3c)
**Done when:** jlaero.com serves production with verified-only charter
supply and support email intact.

### Phase 9: Mobile app
apps/mobile scaffold (Expo + expo-router + shared package), M1-M14, realtime,
push, deep links, permissions priming, offline states, force-update gate,
EAS profiles, Sentry.
**Done when:** the full loop (search -> request -> quote -> sign -> pay ->
chat) works on physical iPhone and Android via internal distribution.

### Phase 10: Store release
- Apple Developer ($99/yr), Play Console ($25), APNs key, FCM
- Icons, splash, screenshots (6.5"/5.5" iPhone, Android phone, feature
  graphic), listings, keywords
- Privacy policy URL, Apple privacy questionnaire, Play data safety
- In-app account deletion visible (hard rejection if missing)
- Reviewer account pre-seeded with demo listing + in-progress booking so the
  flow is exercisable without real money
- iOS: TestFlight -> App Review; Android: internal -> closed -> production
**Done when:** installable from both stores.

---

## 5. Locked decisions

- Stack: Next.js, Expo, Supabase (cloud, no Docker), Stripe Connect
- Model deep, UI shallow (3b schema lands in Phase 0.5)
- Payments: separate charges and transfers, hold until completion + window
- Card + ACH at launch; wire is v2
- Contracts: platform template + click-to-sign in v1 (no DocuSign dependency)
- Instant book: opt-in, computed price, ceiling-capped, kill-switchable
- Cancellation: per-listing tier from platform-defined set
- Account deletion anonymizes; counterparty history survives
- Auth: email/password only v1 (avoids Sign in with Apple requirement)
- Role switching: header context switcher, single account
- Mobile v1: booking/chat/requests; listing management web-first
- Sale listings: inquiry-only, stated on-page
- No em dashes in code or docs

## 6. Open decisions (owner + lawyer input needed)

1. **Broker of record vs neutral marketplace** (DOT Part 295): the big one,
   before Phase 8.
2. **Fee incidence:** who bears the 10% (suggest seller-side, all-in pricing).
3. **Deposit model:** deposit % + balance due date (suggest 25% at signing,
   balance 7 days before departure; 100% if booked inside 7 days).
4. **Instant-book price ceiling** (suggest $25k to start).
5. **Cancellation tier percentages** (mechanism locked; numbers need blessing).
6. **Contract paper:** platform template vs operator's own (suggest platform
   template v1, operator addenda allowed).
7. Minimum insurance liability to list, or filter-only.
8. ACH maximum / when wires become necessary.
9. Currency beyond USD.

## 7. Explicitly NOT in v1 (the cutline)

Shared/per-seat charter, automatic ferry/positioning calculation, structured
FBO database, multi-leg UI (model supports it), wire transfers, DocuSign-class
e-signature, SMS notifications, operator team members (additive later via a
membership table + RLS clause; single principal login at launch), map view /
saved searches / comparison view, typing indicators + message search, blog +
referral program, admin impersonation, full financial reconciliation dashboard
(Stripe dashboard suffices), PEP screening, multi-currency, i18n, biometric
unlock, iPad layouts, in-app notification center (badge + email + push only),
recurring availability blocks, external calendar import.
