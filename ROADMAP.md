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
| M12 | Account | Profile, roles, verification status, settings, sign out |
| M13 | Verification upload | Camera/photo picker for docs |
| M14 | Push notification handling | Booking updates + new messages |

---

## 3. System work (not pages)

| # | Item | Notes |
|---|------|-------|
| S1 | Booking engine server logic | Create request, quote, accept, decline, cancel, complete; enforce state machine transitions server-side (shared `canTransition`) [ ] |
| S2 | Conversations auto-create per booking | On first message or on request creation [ ] |
| S3 | Realtime messaging | Supabase Realtime channel per conversation [ ] |
| S4 | Photo upload pipeline | Client upload to storage buckets, position ordering, image resize (Next/Image + Supabase transforms) [ ] |
| S5 | Stripe Connect | Provider onboarding (Express), destination charges with application fee (10%), webhooks (payment succeeded/failed/refund), payout records [ ] |
| S6 | Email notifications | Booking events + new message digests (Resend or SMTP via Supabase) [ ] |
| S7 | Push notifications | Expo push tokens table + send on booking/message events [ ] |
| S8 | Search/filters | Postgres queries with indexes; airport code normalization [ ] |
| S9 | Admin role and tooling | Grant admin to your account via SQL, admin route guard [ ] |
| S10 | Generated DB types | Replace placeholder database.types.ts [ ] |
| S11 | Tests | Booking state machine unit tests, RLS policy tests (critical paths), booking flow integration test [ ] |
| S12 | CI | GitHub Actions: typecheck + build + tests on push [ ] |
| S13 | Seed script | Demo aircraft/crew/sale data for dev [ ] |
| S14 | Analytics | PostHog (web + mobile) or Vercel Analytics [ ] |
| S15 | Error tracking | Sentry (web + mobile) [ ] |

---

## 4. Build phases (we follow this order)

### Phase 0: Foundation  [x] DONE
Monorepo, schema + RLS (hardened), auth, onboarding, dashboard, landing.

### Phase 1: Charter supply (owners can list)
Pages: O1, O2, O3, O4, O5 + S4 (photo upload) + S13 (seed data)
**Done when:** an owner can create an aircraft listing with photos and
availability, publish it, and see it live.

### Phase 2: Charter demand (travelers can find and request)
Pages: P2, P3 + S8 (search)
**Done when:** a visitor can search, open an aircraft, and submit a booking
request (or instant-book intent) that appears in the owner's requests.

### Phase 3: Booking engine + messaging
Pages: A3, A4, A5, A6, O6 + S1, S2, S3
**Done when:** request -> quote -> negotiate in chat -> accept -> (pay pending)
flows end to end between two real accounts.

### Phase 4: Payments
Pages: A9, O9 + S5
**Done when:** a buyer pays for an accepted booking, platform fee is taken,
provider sees pending payout, webhook updates booking to paid; refund path works.

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
- Legal + marketing pages: P9, P10, P11, P12, P13
- SEO: metadata, OG images, sitemap.xml, robots.txt
- S6 email, S14 analytics, S15 error tracking, S11 tests, S12 CI
- Deploy to Vercel (production project + env vars)
- Supabase production hygiene: re-enable email confirmation, custom SMTP,
  rotate DB password, enable point-in-time backups
- Stripe live mode keys + live webhooks
- Domain cutover: point jlaero.com DNS to Vercel (currently on old cPanel
  host; keep old host until DNS settles, then cancel hosting)
**Done when:** https://jlaero.com serves the new platform in production.

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
- Sign-in test account for reviewers

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
- Instant-book is per-listing opt-in; default flow is request -> quote
- Mobile v1 scope: booking + messaging + request handling; heavy listing
  management stays on web
- No em dashes in code or docs

## 6. Open decisions (to settle when we reach them)

- Email provider for transactional mail (suggest Resend)
- Analytics: PostHog vs Vercel Analytics (suggest PostHog, works on mobile too)
- Instant-book payment timing: authorize at booking vs charge on acceptance
- Currency support beyond USD at launch
- Whether sale listings get escrow/payments later or stay inquiry-only
