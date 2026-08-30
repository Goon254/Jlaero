-- Phase 0.5: charter domain model (model deep, UI shallow).
-- Legs, passengers, line-item quotes, contracts, cancellation tiers,
-- state machine v2, document expiry, airports, audit, flags, favorites,
-- reports, notification preferences, double-booking exclusion.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- New enums
-- ---------------------------------------------------------------------------
create type quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded');
create type quote_line_kind as enum (
  'flight_time', 'positioning', 'daily_minimum', 'landing_fees',
  'crew_overnight', 'catering', 'fuel_surcharge', 'discount',
  'tax_fet', 'tax_segment', 'other'
);
create type contract_status as enum ('pending', 'signed', 'void');
create type cancellation_tier as enum ('flexible', 'moderate', 'strict');
create type cancel_actor as enum ('buyer', 'provider', 'platform');
create type cancel_reason as enum ('standard', 'weather', 'mechanical', 'other');
create type favorite_target as enum ('aircraft', 'crew', 'sale');
create type report_target as enum ('aircraft', 'crew', 'sale', 'user', 'message');
create type report_status as enum ('open', 'actioned', 'dismissed');

-- ---------------------------------------------------------------------------
-- Booking status v2 (no data exists yet, so swap the type wholesale)
-- ---------------------------------------------------------------------------
-- The reviews insert policy references status = 'completed', so drop it first.
drop policy "reviewer writes review" on reviews;

alter type booking_status rename to booking_status_old;
create type booking_status as enum (
  'requested', 'quoted', 'negotiating', 'accepted',
  'contract_signed', 'deposit_paid', 'paid_in_full',
  'in_progress', 'completed',
  'cancelled', 'declined', 'refunded', 'expired', 'disputed'
);
alter table bookings alter column status drop default;
alter table bookings alter column status type booking_status
  using status::text::booking_status;
alter table bookings alter column status set default 'requested';
drop type booking_status_old;

create policy "reviewer writes review" on reviews for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1 from bookings b where b.id = booking_id
    and (b.buyer_id = (select auth.uid()) or b.provider_id = (select auth.uid()))
    and b.status = 'completed'
  )
);

-- ---------------------------------------------------------------------------
-- Bookings: itinerary moves to legs; add cancellation detail, occupancy,
-- structured requests, accepted quote pointer (FK added after quotes)
-- ---------------------------------------------------------------------------
alter table bookings
  drop column origin,
  drop column destination,
  drop column depart_at,
  drop column return_at,
  drop column passengers;

alter table bookings
  add column cancelled_by cancel_actor,
  add column cancel_reason cancel_reason,
  add column occupied_from timestamptz,
  add column occupied_to timestamptz,
  add column pets boolean not null default false,
  add column luggage_notes text,
  add column catering_notes text,
  add column special_requests text;

-- Double-booking prevention: overlapping occupancy is impossible for the
-- same aircraft (or crew profile) once a booking is accepted or beyond.
alter table bookings add constraint bookings_no_overlap_aircraft
  exclude using gist (
    aircraft_id with =,
    tstzrange(occupied_from, occupied_to) with &&
  )
  where (
    status in ('accepted', 'contract_signed', 'deposit_paid', 'paid_in_full', 'in_progress')
    and aircraft_id is not null
    and occupied_from is not null
  );

alter table bookings add constraint bookings_no_overlap_crew
  exclude using gist (
    crew_profile_id with =,
    tstzrange(occupied_from, occupied_to) with &&
  )
  where (
    status in ('accepted', 'contract_signed', 'deposit_paid', 'paid_in_full', 'in_progress')
    and crew_profile_id is not null
    and occupied_from is not null
  );

-- ---------------------------------------------------------------------------
-- Booking legs and passengers
-- ---------------------------------------------------------------------------
create table booking_legs (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references bookings(id) on delete cascade,
  position        int not null default 0,
  origin          text not null,            -- ICAO/IATA code
  destination     text,                     -- null for crew engagements
  depart_at       timestamptz,
  passengers      int,
  origin_fbo      text,
  destination_fbo text,
  unique (booking_id, position)
);

create table booking_passengers (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(id) on delete cascade,
  full_name     text not null,
  date_of_birth date,
  weight_kg     numeric(5,1),
  notes         text
);
create index booking_passengers_booking_id_idx on booking_passengers (booking_id);

-- ---------------------------------------------------------------------------
-- Quotes: versioned line-item documents
-- ---------------------------------------------------------------------------
create table quotes (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  version    int not null,
  created_by uuid references profiles(id) on delete set null,
  status     quote_status not null default 'sent',
  currency   text not null default 'USD',
  total      numeric(14,2) not null default 0,
  expires_at timestamptz,
  notes      text,
  created_at timestamptz not null default now(),
  unique (booking_id, version)
);

create table quote_line_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  kind        quote_line_kind not null,
  description text,
  quantity    numeric(10,2) not null default 1,
  unit_amount numeric(14,2) not null default 0,
  amount      numeric(14,2) not null,
  position    int not null default 0
);
create index quote_line_items_quote_id_idx on quote_line_items (quote_id);

-- The accepted quote version is frozen onto the booking.
alter table bookings
  add column accepted_quote_id uuid references quotes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Contracts (platform template + click-to-sign in v1)
-- ---------------------------------------------------------------------------
create table contracts (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references bookings(id) on delete cascade,
  quote_id          uuid references quotes(id) on delete set null,
  template_version  text not null default 'v1',
  pdf_path          text,
  status            contract_status not null default 'pending',
  buyer_signed_at   timestamptz,
  buyer_signer_name text,
  buyer_signer_ip   text,
  created_at        timestamptz not null default now()
);
create index contracts_booking_id_idx on contracts (booking_id);

-- ---------------------------------------------------------------------------
-- Listing pricing, policy, feasibility, safety-rating fields
-- ---------------------------------------------------------------------------
alter table aircraft
  add column daily_minimum_hours numeric(5,2),
  add column overnight_crew_fee  numeric(12,2),
  add column positioning_included boolean not null default true,
  add column range_nm            int,
  add column min_runway_ft       int,
  add column argus_rating        text,
  add column wyvern_rating       text,
  add column is_bao_stage        text,
  add column cancellation_tier   cancellation_tier not null default 'moderate';

alter table crew_profiles
  add column cancellation_tier cancellation_tier not null default 'moderate',
  add column medical_class     text,
  add column medical_expires   date;

-- ---------------------------------------------------------------------------
-- Document expiry + aircraft-level documents
-- ---------------------------------------------------------------------------
alter table verification_documents
  add column expires_at       date,
  add column aircraft_id      uuid references aircraft(id) on delete cascade,
  add column liability_limit  numeric(14,2),
  add column rejection_reason text,
  add column reviewed_at      timestamptz;
create index verification_documents_aircraft_id_idx on verification_documents (aircraft_id);
create index verification_documents_expires_at_idx on verification_documents (expires_at);

-- Suspension flag (suspended users see a notice; enforcement server-side)
alter table profiles add column suspended_at timestamptz;

-- ---------------------------------------------------------------------------
-- Airports reference (data imported in the next migration; tz filled later)
-- ---------------------------------------------------------------------------
create table airports (
  icao              text primary key,
  iata              text,
  name              text not null,
  municipality      text,
  iso_country       text,
  latitude          double precision,
  longitude         double precision,
  longest_runway_ft int,
  tz                text
);
create index airports_iata_idx on airports (iata);
create index airports_iso_country_idx on airports (iso_country);

-- ---------------------------------------------------------------------------
-- Audit log, feature flags, favorites, reports, notification preferences
-- ---------------------------------------------------------------------------
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_at_idx on audit_logs (created_at desc);
create index audit_logs_actor_id_idx on audit_logs (actor_id);

create table feature_flags (
  key        text primary key,
  enabled    boolean not null default false,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into feature_flags (key, enabled, value) values
  ('instant_book', false, '{"price_ceiling_usd": 25000}'::jsonb);

create table favorites (
  user_id     uuid not null references profiles(id) on delete cascade,
  target_type favorite_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type report_target not null,
  target_id   uuid not null,
  reason      text not null,
  details     text,
  status      report_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index reports_status_idx on reports (status);

create table notification_preferences (
  user_id    uuid primary key references profiles(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
create or replace function is_booking_party(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where id = b
      and (buyer_id = (select auth.uid()) or provider_id = (select auth.uid()))
  );
$$;

alter table booking_legs             enable row level security;
alter table booking_passengers       enable row level security;
alter table quotes                   enable row level security;
alter table quote_line_items         enable row level security;
alter table contracts                enable row level security;
alter table airports                 enable row level security;
alter table audit_logs               enable row level security;
alter table feature_flags            enable row level security;
alter table favorites                enable row level security;
alter table reports                  enable row level security;
alter table notification_preferences enable row level security;

-- booking sub-resources: visible and writable by the booking parties;
-- server actions enforce the finer state discipline
create policy "party reads legs" on booking_legs for select to authenticated
  using (is_booking_party(booking_id) or (select is_admin()));
create policy "party writes legs" on booking_legs for all to authenticated
  using (is_booking_party(booking_id)) with check (is_booking_party(booking_id));

create policy "party reads passengers" on booking_passengers for select to authenticated
  using (is_booking_party(booking_id) or (select is_admin()));
create policy "party writes passengers" on booking_passengers for all to authenticated
  using (is_booking_party(booking_id)) with check (is_booking_party(booking_id));

create policy "party reads quotes" on quotes for select to authenticated
  using (is_booking_party(booking_id) or (select is_admin()));
create policy "party creates quotes" on quotes for insert to authenticated
  with check (is_booking_party(booking_id) and created_by = (select auth.uid()));
create policy "party updates quotes" on quotes for update to authenticated
  using (is_booking_party(booking_id));

create policy "party reads line items" on quote_line_items for select to authenticated
  using (exists (select 1 from quotes q where q.id = quote_id and is_booking_party(q.booking_id))
         or (select is_admin()));
create policy "party writes line items" on quote_line_items for all to authenticated
  using (exists (select 1 from quotes q where q.id = quote_id and is_booking_party(q.booking_id)))
  with check (exists (select 1 from quotes q where q.id = quote_id and is_booking_party(q.booking_id)));

-- contracts are created and signed server-side; parties can read
create policy "party reads contracts" on contracts for select to authenticated
  using (is_booking_party(booking_id) or (select is_admin()));

create policy "airports are public" on airports for select using (true);

create policy "admin reads audit" on audit_logs for select to authenticated
  using ((select is_admin()));

create policy "flags are public" on feature_flags for select using (true);
create policy "admin manages flags" on feature_flags for all to authenticated
  using ((select is_admin()));

create policy "own favorites" on favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "file a report" on reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "see own or admin reports" on reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select is_admin()));
create policy "admin updates reports" on reports for update to authenticated
  using ((select is_admin()));

create policy "own notification prefs" on notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
