# Jlaero Roadmap: every page, every screen, to live

This is the build-following document. We work top to bottom by phase. A phase is
done when its "Done when" line is true. Check things off as we go.

Status legend: [x] done, [~] in progress, [ ] not started

---

## 1. Complete web page inventory

### 1.1 Public pages (no login)

| # | Route | Page | What's on it |
|---|-------|------|--------------|
| P1 | `/` | Landing | Hero, three marketplace cards, how it works, trust/verification blurb, footer. [x] basic version |
| P2 | `/charter` | Charter browse/search | Search bar (from, to, date, passengers), filter sidebar (category, seats, price), aircraft result cards |
| P3 | `/charter/[id]` | Aircraft detail | Photo gallery, specs, hourly rate, owner card (verified badge, rating), availability calendar, "Book / Request quote" CTA |
| P4 | `/crew` | Crew browse | Filter by role (captain, FO, cabin), home base, day rate; crew cards |
| P5 | `/crew/[id]` | Crew profile detail | Photo, headline, licenses and type ratings, total hours, rate, reviews, "Hire" CTA |
| P6 | `/marketplace` | Aircraft for sale | Filter by make, model, year, price; sale listing cards |
| P7 | `/marketplace/[id]` | Sale listing detail | Gallery, specs, price, location, seller card, inquiry form |
| P8 | `/login` | Sign in / sign up | [x] done |
| P8b | `/forgot-password` + `/reset-password` | Password reset | Request reset email, set new password. Required before launch |
| P9 | `/list` | "List with Jlaero" | Pitch page for owners and crew, CTA into signup/onboarding |
| P10 | `/about` | About | Company story, contact info |
| P11 | `/terms` | Terms of Service | Required for app store approval |
| P12 | `/privacy` | Privacy Policy | Required for app store approval and Play data safety |
| P13 | `/contact` | Contact | Support email, form |

### 1.2 Authenticated pages (any role)

| # | Route | Page | What's on it |
|---|-------|------|--------------|
| A1 | `/onboarding` | Onboarding | [x] done: name, account type, home base, role opt-ins |
| A2 | `/dashboard` | Dashboard | [x] basic version: role-aware tiles |
| A3 | `/bookings` | My bookings | List as buyer AND as provider, status chips, filter by state |
| A4 | `/bookings/[id]` | Booking detail | Status timeline (state machine), trip details, price/quote box, embedded conversation, action buttons per state (accept, quote, pay, cancel, complete, review) |
| A5 | `/messages` | Inbox | All conversations, unread badges |
| A6 | `/messages/[id]` | Conversation | Realtime thread, linked booking summary card |
| A7 | `/settings` | Profile settings | Name, avatar upload, phone, company, password change |
| A8 | `/settings/verification` | Verification | Upload ID / operator certificate / license / insurance, see status per doc |
| A9 | `/settings/payments` | Payments | Saved payment status, Stripe Connect onboarding state (for providers), payout account |
| A10 | `/settings/delete-account` | Account deletion | REQUIRED by both App Store and Play Store. Anonymizes the user (bookings/reviews of the other party must survive), signs out, disables login |

### 1.3 Owner pages (role: owner)

| # | Route | Page | What's on it |
|---|-------|------|--------------|
| O1 | `/owner` | Owner dashboard | Listings summary, pending requests count, earnings snapshot |
| O2 | `/owner/aircraft` | My aircraft | Cards with status (draft/active/paused), quick actions |
| O3 | `/owner/aircraft/new` | New aircraft | Multi-step form: details, specs, photos, pricing, instant-book toggle |
| O4 | `/owner/aircraft/[id]/edit` | Edit aircraft | Same form, prefilled; publish/pause/archive |
| O5 | `/owner/aircraft/[id]/availability` | Availability | Calendar: block/unblock date ranges |
| O6 | `/owner/requests` | Booking requests | Incoming charter requests: accept, send quote, decline; opens conversation |
| O7 | `/owner/sales` | My sale listings | List, create, edit sale listings; mark under offer / sold |
| O8 | `/owner/sales/new` + `/owner/sales/[id]/edit` | Sale listing form | Details, photos, price, location |
| O9 | `/owner/earnings` | Earnings | Completed payouts, pending balance, Stripe Connect status |

### 1.4 Crew pages (role: crew)

| # | Route | Page | What's on it |
|---|-------|------|--------------|
| C1 | `/crew/me` | My crew profile | Edit headline, kind, licenses, type ratings, hours, day rate, bio; publish/pause |
| C2 | `/crew/me/availability` | Availability | Calendar: block/unblock dates |
| C3 | `/crew/requests` | Hire requests | Incoming crew bookings: accept, quote, decline |

### 1.5 Admin pages (role: admin)

| # | Route | Page | What's on it |
|---|-------|------|--------------|
| AD1 | `/admin` | Admin overview | Counts: users, listings, bookings, revenue, pending verifications |
| AD2 | `/admin/verifications` | Verification queue | Review uploaded docs, approve/reject with notes, sets profile verification status |
| AD3 | `/admin/users` | Users | Search, view, suspend, grant roles |
| AD4 | `/admin/listings` | Listings moderation | Approve/hide aircraft, crew, and sale listings |
| AD5 | `/admin/bookings` | Bookings and disputes | View any booking, force-cancel/refund entry point |

---

## 2. Complete mobile app screen inventory (Expo: iOS + Android)

One codebase in `apps/mobile`. Tab bar: **Explore, Bookings, Messages, Account**.
Mobile v1 focuses on booking, messaging, and request handling. Heavy listing
management (photo-rich forms, admin) stays web-first for v1.

| # | Screen | Notes |
|---|--------|-------|
| M1 | Welcome / Sign in / Sign up | Email+password, matches web auth |
| M2 | Onboarding | Same fields as web A1 |
| M3 | Explore: Charter search | Search + filters, result cards |
| M4 | Aircraft detail | Gallery, specs, book/request |
| M5 | Explore: Crew | Browse + crew detail + hire |
| M6 | Explore: Marketplace | Browse + sale detail + inquire |
| M7 | Bookings list | Buyer and provider views |
| M8 | Booking detail | Status timeline, actions per state, pay (Stripe; charter is a physical service so Apple IAP is NOT required), open chat |
| M9 | Messages inbox | Unread badges |
| M10 | Conversation | Realtime chat + push notifications |
| M11 | Requests inbox (providers) | Accept / quote / decline |
| M12 | Account | Profile, roles, verification status, settings, sign out, account deletion (store requirement) |
| M13 | Verification upload | Camera/photo picker for docs |
| M14 | Push notification handling | Booking updates + new messages; deep links open the right booking/conversation screen |
| M15 | Password reset | Request reset from sign-in screen |

---

## 3. System work (not pages)

| # | Item | Notes |
|---|------|-------|
| S1 | Booking engine server logic | Create request, quote, accept, decline, cancel, complete; enforce state machine transitions server-side (shared `canTransition`) [ ] |
| S2 | Conversations auto-create per booking | On first message or on request creation [ ] |
| S3 | Realtime messaging | Supabase Realtime channel per conversation [ ] |
| S4 | Photo upload pipeline | Client upload to storage buckets, position ordering, image resize (Next/Image + Supabase transforms) [ ] |
| S5 | Stripe Connect | Provider onboarding (Express). Money flow: SEPARATE charges and transfers, NOT destination charges: charge buyer at acceptance, funds sit on platform balance, transfer to provider minus 10% fee on completion. Webhooks: payment succeeded/failed, refund, dispute/chargeback. High-ticket note: cards often fail above ~$10k; ACH/bank transfer is the follow-up (open decision) [ ] |
| S6 | Email notifications | Booking events + new message digests (Resend or SMTP via Supabase) [ ] |
| S7 | Push notifications | Expo push tokens table + send on booking/message events [ ] |
| S8 | Search/filters (v1 definition) | Charter: filter by origin (aircraft home_base exact match OR within N km using airport coordinates), date range vs availability, seats, category, price. No multi-leg routing. Crew: role, home base, rate. Sales: make/model/year/price. Postgres only, no external search service [ ] |
| S9 | Admin role and tooling | Grant admin to your account via SQL, admin route guard [ ] |
| S10 | Generated DB types | Replace placeholder database.types.ts [ ] |
| S11 | Tests | Booking state machine unit tests, RLS policy tests (critical paths), booking flow integration test [ ] |
| S12 | CI | GitHub Actions: typecheck + build + tests on push [ ] |
| S13 | Seed script | Demo aircraft/crew/sale data for dev [ ] |
| S14 | Analytics | PostHog (web + mobile) or Vercel Analytics [ ] |
| S15 | Error tracking | Sentry (web + mobile) [ ] |
| S16 | Airports reference table | Import open airports dataset (OurAirports): code, name, coordinates, timezone. Powers autocomplete, near-me search, distance-based instant pricing, and airport-local time display [ ] |
| S17 | Account deletion + anonymization | Edge function: strip PII from profile, keep bookings/reviews rows for the other party (no cascade delete of shared history), delete auth user. Store-compliance item [ ] |
| S18 | Prod/dev environment split | Second Supabase project for production before launch; current project becomes dev. Env-per-environment on Vercel and EAS [ ] |

---

## 3b. Booking rules and edge cases (decided now, implemented in phases)

- **Availability semantics:** an aircraft/crew is available unless a blocked
  range or an accepted/paid booking covers the dates. Owners block, not open.
- **Double-booking prevention:** a Postgres exclusion constraint on
  accepted/paid charter bookings (aircraft_id + date range) so two bookings can
  never both be accepted for overlapping dates; friendly conflict check in the
  UI before that error can surface. Same for crew.
- **provider_id integrity:** booking creation happens server-side; the server
  derives provider_id from the aircraft/crew profile. Never trusted from the
  client (RLS alone does not prevent a buyer naming an arbitrary provider).
- **Quote expiry:** quotes carry expires_at (default 72h); expired quotes fall
  back to `requested` and the buyer is notified.
- **Cancellation policy (v1):** before acceptance: free, either side. After
  acceptance, before payment: free, either side, with notification. After
  payment: buyer cancellation refunds per a simple schedule (>7 days: 100%,
  7 days to 48h: 50%, <48h: no refund); provider cancellation always refunds
  100% and flags the provider for admin review. Exact percentages are an open
  decision; the mechanism is not.
- **Timezones:** store timestamptz; display in the AIRPORT's local time
  (aviation convention) using the airports table timezone.
- **Trip shape (v1):** one-way or round trip on one aircraft. No multi-leg.
- **Crew bookings:** reuse the same table; origin = work location, destination
  null, depart_at/return_at = engagement period, passengers null.
- **Instant book (definition):** owner opt-in per listing. Price is computed:
  great-circle distance between airports / cruise speed for the aircraft
  category x hourly rate, + owner-set minimum charge. Buyer pays immediately;
  booking jumps to `paid`. Ships in Phase 4 (needs payments), request/quote is
  the only flow before then.
- **Sale listings:** inquiry-only in v1. No escrow, no in-app purchase of
  aircraft.

## 3c. Regulatory and trust requirements (not optional for real launch)

- **US charter legality:** selling charter flights requires the operator to
  hold an FAA Part 135 certificate. Private (Part 91) owners cannot legally
  sell charter to the public. Before public launch (Phase 8), publishing a
  charter listing as ACTIVE requires an approved operator certificate in the
  verification queue. During development phases, unverified listings are
  allowed in the dev environment only.
- **Pilot verification:** crew profiles show a "verified" badge only after
  license review; unverified crew can exist but are labeled.
- **Platform positioning:** terms of service must state Jlaero is a
  marketplace/technology platform, not an air carrier or operator; the
  operator is the carrier of record. Get a lawyer's pass on P11 before launch.
- **Insurance:** operators upload proof of insurance as part of verification.
- **Disintermediation:** users will try to close deals off-platform to avoid
  the 10% fee. v1 accepts this risk; do not build detection yet, but keep
  contact-info exchange out of listing pages (chat only, post-request).

---

## 4. Build phases (we follow this order)

### Phase 0: Foundation  [x] DONE
Monorepo, schema + RLS (hardened), auth, onboarding, dashboard, landing.

### Phase 1: Charter supply (owners can list)
Pages: O1, O2, O3, O4, O5 + S4 (photo upload) + S13 (seed data) + S16 (airports
table, powers home-base autocomplete now and search/pricing later)
**Done when:** an owner can create an aircraft listing with photos and
availability, publish it, and see it live.

### Phase 2: Charter demand (travelers can find and request)
Pages: P2, P3 + S8 (search per its v1 definition)
**Done when:** a visitor can search, open an aircraft, and submit a booking
request that appears in the owner's requests. (Instant book comes in Phase 4.)

### Phase 3: Booking engine + messaging
Pages: A3, A4, A5, A6, O6 + S1, S2, S3 + double-booking exclusion constraint
+ quote expiry + server-derived provider_id (see 3b)
**Done when:** request -> quote -> negotiate in chat -> accept -> (pay pending)
flows end to end between two real accounts, and overlapping accepted bookings
are impossible.

### Phase 4: Payments
Pages: A9, O9 + S5 (charges-and-transfers model) + instant book per 3b
+ cancellation/refund schedule + dispute webhooks
**Done when:** a buyer pays for an accepted booking, funds are held on the
platform, provider transfer fires on completion minus the 10% fee; refunds
follow the cancellation schedule; instant book charges the computed price.

### Phase 5: Reviews + verification + settings
Pages: A7, A8 + review UI on A4 + S9 + AD1, AD2 (minimum admin)
**Done when:** completed bookings can be reviewed; users can upload docs and
admin can approve them; ratings show on listings.

### Phase 6: Crew marketplace
Pages: P4, P5, C1, C2, C3 (reuses booking engine + messaging + payments)
**Done when:** a crew member publishes a profile and gets booked and paid
through the same flow as charter.

### Phase 7: Aircraft sales
Pages: P6, P7, O7, O8 + inquiry -> conversation wiring
**Done when:** a seller lists an aircraft for sale and a buyer's inquiry opens
a conversation.

### Phase 8: Web launch
- Legal + marketing pages: P9, P10, P11, P12, P13 (P11 terms reviewed per 3c)
- Auth completeness: P8b password reset, A10 account deletion (S17)
- Verification gating live: active charter listings require approved operator
  certificate (3c); AD2 verification queue must be working
- SEO: metadata, OG images, sitemap.xml, robots.txt
- S6 email, S14 analytics, S15 error tracking, S11 tests, S12 CI
- S18 environment split: create the PRODUCTION Supabase project; current one
  becomes dev. Deploy to Vercel with prod env vars
- Supabase production hygiene: re-enable email confirmation, custom SMTP,
  rotate DB password, enable point-in-time backups
- Stripe live mode keys + live webhooks
- **Email cutover first:** support@jlaero.com currently lives on the old
  cPanel host. Move mail (e.g. Google Workspace or Zoho) and update MX
  records BEFORE the DNS cutover, or support email dies silently
- Domain cutover: point jlaero.com DNS to Vercel (keep old host until DNS
  settles, then cancel hosting)
**Done when:** https://jlaero.com serves the new platform in production and
support email still works.

### Phase 9: Mobile app
- Scaffold `apps/mobile` (Expo + expo-router), share `@jlaero/shared`
- Screens M1..M14, Supabase auth session storage, realtime, push (S7)
- EAS Build profiles (dev, preview, production)
**Done when:** the full booking loop works on a physical iPhone and Android
device via internal distribution.

### Phase 10: App Store + Play Store release
Accounts and one-time setup:
- Apple Developer Program ($99/yr) and Play Console ($25 one-time)
- App identifiers, APNs key for push (Apple), FCM config (Google)

Assets and compliance:
- App icon, splash screen, 6.5" + 5.5" iPhone screenshots, iPad if targeted,
  Android phone screenshots, feature graphic
- Store listings (title, subtitle, description, keywords)
- Privacy policy URL (P12), App Privacy questionnaire (Apple), Data safety
  form (Google)
- In-app account deletion visible and working (hard rejection if missing)
- Sign-in test account for reviewers, pre-seeded with a demo listing and a
  booking in progress so reviewers can exercise the app

Release train:
- iOS: EAS Submit -> TestFlight beta -> fix feedback -> App Review -> release
- Android: EAS Submit -> internal testing -> closed track -> production
- Expect 1-2 review round trips; charter booking apps are normal-approval
  category, and payments via Stripe are allowed because flights are physical
  services

**Done when:** Jlaero is installable from the App Store and Google Play.

---

## 5. Decisions already locked

- Stack: Next.js web, Expo mobile, Supabase backend, Stripe Connect payments
- Cloud Supabase, no Docker; migrations via `supabase db push`
- Platform fee: 10% (constant in `@jlaero/shared`, changeable)
- Instant-book is per-listing opt-in with computed pricing (3b); ships with
  payments in Phase 4; default flow is request -> quote
- Payments: separate charges and transfers (hold until completion), never
  destination charges
- Account deletion anonymizes; shared history (bookings, reviews) survives
- Auth is email/password only in v1 (no social login, which also avoids the
  Apple "Sign in with Apple" requirement)
- Mobile v1 scope: booking + messaging + request handling; heavy listing
  management stays on web
- No em dashes in code or docs

## 6. Open decisions (to settle when we reach them)

- Email provider for transactional mail (suggest Resend)
- Analytics: PostHog vs Vercel Analytics (suggest PostHog, works on mobile too)
- Cancellation refund schedule percentages (mechanism is locked in 3b)
- ACH / bank transfer for high-ticket payments, and at what threshold
- Currency support beyond USD at launch
- Whether sale listings get escrow/payments later or stay inquiry-only
- Search radius default for "near origin" matching

## 7. Explicitly NOT in v1 (the cutline)

Named so nobody wonders if we forgot them:

- Empty-leg flight deals (big private-aviation feature; strong v2 candidate)
- Multi-leg itineraries
- Multi-currency, i18n
- Chat attachments and voice
- In-app notification center (push + email only)
- Off-platform-deal (disintermediation) detection
- Auction/bidding on charters
- Loyalty/membership programs
- iPad-optimized layouts
