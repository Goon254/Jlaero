# Jlaero — Platform Plan

**Jlaero is a private-aviation marketplace: "Uber for private jets."**
Web app + mobile app, launching as a real product.

---

## 1. The marketplace

Four sides:

| Side | What they do |
|------|--------------|
| **Travelers / Buyers** | Charter a jet, hire pilots/crew, buy an aircraft |
| **Owners / Operators** (people & businesses) | List jets for charter, list jets for sale, hire crew |
| **Pilots & Crew** | Create profiles, set rates & availability, get booked |
| **Admin / Ops** | Verify users, moderate listings, handle disputes, manage payouts |

Three marketplaces inside one platform:

- **A. Charter booking** — book a private jet for a trip
- **B. Crew marketplace** — book pilots, flight attendants, crew
- **C. Aircraft sales** — list & inquire on jets for sale

Booking modes: **instant-book** (where the operator enables it, Uber-style) **or
request → quote → negotiate** over in-app messaging.

---

## 2. Core features

- **Accounts & roles** — one account can be traveler *and* owner *and* crew
- **Verification / KYC** — critical in aviation: operator certificates, pilot
  licenses & ratings, insurance, ID. High-trust, high-ticket.
- **Listings** — aircraft (charter), aircraft (for sale), crew profiles; photos,
  specs, base airport, pricing, availability calendar
- **Search & discovery** — by route, date, passengers, aircraft type, price
- **Booking engine** — states: requested → quoted → negotiating → accepted →
  paid → completed → reviewed (also cancelled/refunded)
- **In-app messaging** — real-time, for negotiation and coordination
- **Payments & payouts** — hold funds, release on completion, platform fee,
  payouts to owners/crew (marketplace model)
- **Reviews & ratings** — both directions
- **Notifications** — push (mobile) + email
- **Admin dashboard** — verification queue, moderation, disputes, payouts

---

## 3. Recommended tech stack

One language (TypeScript) across web, mobile, and backend, in a monorepo.

| Layer | Choice | Why |
|-------|--------|-----|
| **Web** | Next.js (React) | SSR/SEO for public listings & marketing; fast |
| **Mobile** | Expo (React Native) | iOS + Android from one codebase; shares code with web |
| **Backend / DB** | Supabase (Postgres, Auth, Realtime, Storage, RLS) | Real-time messaging, auth, file storage built in; launch fast, scales on Postgres |
| **Payments** | Stripe Connect | Marketplace payouts, held funds, platform fee; Stripe Identity for KYC |
| **Search** | Postgres FTS → Meilisearch/Algolia later | Start simple, upgrade when needed |
| **Hosting** | Vercel (web) + Supabase (backend) + EAS (mobile builds) | Managed, low ops burden |
| **Monorepo** | pnpm + Turborepo, shared `packages/` for types & validation (Zod) | Type-safe end to end |

Alternative if we want full control over the backend: custom **NestJS + Postgres**
API instead of Supabase — more power, more work. Recommendation is Supabase to
reach launch faster; we can peel off custom services later.

---

## 4. Data model (core entities)

- `users`, `profiles` (multi-role)
- `companies` / `operators`
- `aircraft` (charter listings: type, seats, base airport, rates, photos, status)
- `aircraft_availability`
- `crew_profiles` (role, licenses/ratings, rates, availability)
- `sale_listings` (aircraft for sale)
- `bookings` (charter or crew; state machine above)
- `conversations`, `messages`
- `payments`, `payouts`
- `reviews`
- `verifications` / `documents`

---

## 5. Build order (ship one full loop first)

- **Phase 0 — Foundation:** monorepo, infra, auth, roles, data model, design system
- **Phase 1 — Charter MVP (end-to-end):** owner lists jet → traveler searches →
  book/request → message → pay → complete → review. *This proves the whole engine.*
- **Phase 2 — Crew marketplace:** reuse the booking engine for pilots/crew
- **Phase 3 — Aircraft sales:** listings + inquiries (lead-gen)
- **Phase 4 — Mobile app:** bring web features to iOS/Android + push notifications
- **Phase 5 — Launch hardening:** admin/ops tools, KYC, analytics, payments edge cases

We get Phase 1 working completely before fanning out — everything else reuses it.

---

## 6. Reference material

The old WordPress site is mirrored in `site/` (branding, copy, images) as
reference only. The new platform is a fresh codebase. See `MIGRATION.md`.
