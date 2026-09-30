-- Broker-assisted trip workflow (leadership spec 2026-09-29).
-- Spec: docs/specs/01-workflow-summary.md, docs/specs/02-technical-blueprint.md
-- Design notes: docs/specs/03-implementation.md
--
-- The trip is the central record. It replaces the 0017 request/offer model
-- (trip_requests, operator_quotes, traveler_offers, pricing_policies), which
-- held no data. RFQ rounds, recipients and messages are kept and re-pointed at
-- trips. Marketplace bookings are untouched.
--
-- Money rule: clients can never read operator cost or markup. trip_quotes is
-- column-granted to authenticated, and every client write goes through a
-- security definer function that checks ownership and the trip status.

-- ---------------------------------------------------------------------------
-- 0. Retire the 0017 request/offer model
-- ---------------------------------------------------------------------------
select cron.unschedule('jlaero-sourcing-expiries');
drop function if exists run_sourcing_expiries();
drop function if exists accept_traveler_offer(uuid);
drop view if exists traveler_offer_cards;
alter table bookings drop constraint bookings_check;
alter table bookings drop column trip_request_id, drop column traveler_offer_id;
alter table bookings add constraint bookings_check check (
  (kind = 'charter' and aircraft_id is not null) or
  (kind = 'crew' and crew_profile_id is not null)
);
drop table traveler_offers;
drop table pricing_policies;
drop table operator_quotes;
alter table rfqs drop column trip_request_id;
drop table trip_requests;
drop type offer_status;
drop type offer_tier;
drop type pricing_strategy;
drop type operator_quote_status;
drop type trip_request_status;

-- ---------------------------------------------------------------------------
-- 1. Role helpers
-- ---------------------------------------------------------------------------
create or replace function has_any_role(p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role::text = any(p_roles));
$$;
-- broker controls: trips, quotes, contracts, itineraries
create or replace function is_broker() returns boolean language sql stable security definer set search_path = public as $$
  select has_any_role(array['admin', 'broker']);
$$;
-- finance controls: payment verification, operator payments
create or replace function is_finance() returns boolean language sql stable security definer set search_path = public as $$
  select has_any_role(array['admin', 'finance']);
$$;
create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select has_any_role(array['admin', 'broker', 'finance']);
$$;
grant execute on function has_any_role(text[]), is_broker(), is_finance(), is_staff() to authenticated;

-- Audit log gains before/after values (blueprint s30).
alter table audit_logs add column old_value jsonb, add column new_value jsonb;
create index audit_logs_target_idx on audit_logs (target_type, target_id, created_at desc);
drop policy if exists "admin reads audit" on audit_logs;
create policy "staff reads audit" on audit_logs for select to authenticated using ((select is_staff()));

-- ---------------------------------------------------------------------------
-- 2. Settings (blueprint s34). Nothing about pricing or timing is hard-coded.
-- client_visible rows are readable by any signed-in user.
-- ---------------------------------------------------------------------------
create table app_settings (
  key            text primary key,
  value          jsonb not null,
  client_visible boolean not null default false,
  description    text,
  updated_by     uuid references profiles(id) on delete set null,
  updated_at     timestamptz not null default now()
);
create trigger app_settings_updated before update on app_settings
  for each row execute function set_updated_at();

insert into app_settings (key, value, client_visible, description) values
  ('pricing', '{"default_markup_pct": 10, "min_markup_pct": 5, "catering_default": 0, "vehicle_default": 0, "service_fee": 0}', false,
   'Default markup on operator cost, the floor brokers cannot go below without admin, and default service prices.'),
  ('search', '{"radius_miles": 100, "include_prospects": true, "max_operators": 12, "quote_deadline_hours": 24}', false,
   'Operator search radius around origin and destination, whether unvetted FAA-listed operators are included, RFQ fan-out.'),
  ('automation', '{"reminder_hours": 72, "active_hours_before": 2, "feedback_close_days": 14, "option_expiry_hours": 24}', false,
   'Timing for the 72-hour reminder, when a trip turns active, auto-close after feedback request, and default option expiry.'),
  ('company', '{"name": "Jlaero", "legal_name": "Jlaero", "support_email": "charter@jlaero.com", "support_phone": "", "address": ""}', true,
   'Company details shown on contracts, itineraries and client emails.'),
  ('payment_instructions', '{"credit_card": "Your broker will send a secure card payment link.", "ach": "ACH details will be provided by your broker.", "wire": "Wire instructions will be provided by your broker.", "direct_deposit": "Deposit details will be provided by your broker.", "terms": "Payment in full is due before the operator can confirm the aircraft."}', true,
   'What clients see for each payment method. Replace with the company bank details.'),
  ('cancellation_policy', '{"title": "Cancellation policy", "body": "Placeholder until the company provides its policy. Cancellation terms are set out in your charter agreement. Please contact your broker before making any change to your trip."}', true,
   'Shown in the app, in the 72-hour reminder, and merged into contracts.');

alter table app_settings enable row level security;
create policy "staff reads settings" on app_settings for select to authenticated
  using (client_visible or (select is_staff()));
create policy "admin writes settings" on app_settings for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- ---------------------------------------------------------------------------
-- 3. Clients (blueprint s3). A client may exist without an app account, e.g.
-- a request that arrived by email; user_id links once they sign up.
-- ---------------------------------------------------------------------------
create type contact_method as enum ('email', 'phone', 'sms', 'app');

create table clients (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid unique references profiles(id) on delete set null,
  full_name                text not null,
  email                    text not null,
  phone                    text,
  company_name             text,
  preferred_contact_method contact_method not null default 'email',
  first_time_private_flyer boolean,
  preferences              jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index clients_email_idx on clients (lower(email));
create trigger clients_updated before update on clients
  for each row execute function set_updated_at();

-- Internal notes on any record; never visible to clients (blueprint s2).
create table staff_notes (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('client', 'trip', 'operator', 'quote')),
  target_id   uuid not null,
  author_id   uuid references profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index staff_notes_target_idx on staff_notes (target_type, target_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Operators and their aircraft (blueprint s5, s6)
-- ---------------------------------------------------------------------------
-- prospect: imported from the FAA Part 135 list, not vetted
-- approved: vetted, in the search network
-- preferred: approved and searched first
-- excluded / inactive: never searched
create type operator_network_status as enum ('prospect', 'approved', 'preferred', 'excluded', 'inactive');
create type fleet_availability as enum ('available', 'limited', 'maintenance', 'unavailable', 'unknown');

alter table operators
  add column network_status      operator_network_status not null default 'prospect',
  add column search_priority     int not null default 0,
  add column service_radius_miles int,
  add column areas_served        text,
  add column api_available       boolean not null default false,
  add column email_integration   boolean not null default true,
  add column website_integration boolean not null default false,
  add column integration_notes   text;
create index operators_network_idx on operators (network_status, search_priority desc);

create table operator_aircraft (
  id                  uuid primary key default gen_random_uuid(),
  operator_id         uuid not null references operators(id) on delete cascade,
  aircraft_type       text not null,                  -- display name, e.g. "Gulfstream G450"
  manufacturer        text,
  model               text,
  category            aircraft_category,
  tail_number         text,
  year_mfr            int,
  passenger_capacity  int check (passenger_capacity between 1 and 100),
  range_nm            int,
  home_base_icao      text references airports(icao),
  availability_status fleet_availability not null default 'unknown',
  special_features    text[] not null default '{}',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index operator_aircraft_operator_idx on operator_aircraft (operator_id);
create index operator_aircraft_base_idx on operator_aircraft (home_base_icao);
create unique index operator_aircraft_tail_idx on operator_aircraft (upper(tail_number)) where tail_number is not null;
create trigger operator_aircraft_updated before update on operator_aircraft
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Trips (blueprint s3, s4)
-- ---------------------------------------------------------------------------
create type trip_status as enum (
  'new_request', 'searching', 'quotes_received', 'broker_review', 'options_sent',
  'client_selected', 'contract_sent', 'contract_signed', 'payment_pending',
  'payment_received', 'operator_confirmation_pending', 'confirmed',
  'itinerary_pending', 'itinerary_ready', 'within_72_hours', 'active',
  'operational_issue', 'replacement_search', 'replacement_pending_client',
  'completed', 'feedback_requested', 'closed', 'cancelled'
);
create type trip_source as enum ('app', 'email', 'broker', 'phone');

create sequence trip_number_seq start 1;

create or replace function next_trip_number()
returns text language sql volatile set search_path = public as $$
  select 'TRIP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('trip_number_seq')::text, 6, '0');
$$;

create table trips (
  id                      uuid primary key default gen_random_uuid(),
  trip_number             text not null unique default next_trip_number(),
  client_id               uuid not null references clients(id) on delete restrict,
  broker_id               uuid references profiles(id) on delete set null,
  status                  trip_status not null default 'new_request',
  source                  trip_source not null default 'app',
  origin_icao             text not null references airports(icao),
  destination_icao        text not null references airports(icao),
  -- As the client entered them, local to the departure airport, plus the
  -- resolved instant used for countdowns and reminders.
  departure_date          date not null,
  departure_time          time,
  depart_at               timestamptz not null,
  return_date             date,
  return_time             time,
  return_at               timestamptz,
  passengers              int not null check (passengers between 1 and 50),
  aircraft_category       aircraft_category,
  aircraft_preference     text,                        -- free text, e.g. "Gulfstream G450"
  vehicle_required        boolean not null default false,
  catering_required       boolean not null default false,
  first_time_flyer        boolean,
  special_requests        text,
  missing_info            text[] not null default '{}', -- set by the request parser
  search_radius_miles     numeric(6,1) not null default 100,
  selected_quote_id       uuid,                         -- fk added after trip_quotes
  reminder_72h_sent_at    timestamptz,
  thank_you_sent_at       timestamptz,
  completed_at            timestamptz,
  closed_at               timestamptz,
  cancelled_at            timestamptz,
  cancel_reason           text,
  source_email_id         uuid,                         -- rfq_messages row for email intake
  created_by              uuid references profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (return_at is null or return_at > depart_at)
);
create index trips_client_idx on trips (client_id, created_at desc);
create index trips_status_idx on trips (status, depart_at);
create index trips_broker_idx on trips (broker_id);
create trigger trips_updated before update on trips
  for each row execute function set_updated_at();

create or replace function owns_trip(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips t join clients c on c.id = t.client_id
                 where t.id = p_trip and c.user_id = auth.uid());
$$;
grant execute on function owns_trip(uuid) to authenticated;

-- Timeline of everything that happened on a trip. Status changes are written
-- by trigger so no code path can skip them. Server code sets
-- jlaero.actor_id for the service connection, which has no auth.uid().
create table trip_events (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  actor_id       uuid references profiles(id) on delete set null,
  kind           text not null,                 -- status, note, quote, contract, payment, operator, itinerary, issue, notification, ai
  from_status    trip_status,
  to_status      trip_status,
  message        text,
  meta           jsonb not null default '{}'::jsonb,
  client_visible boolean not null default false,
  created_at     timestamptz not null default now()
);
create index trip_events_trip_idx on trip_events (trip_id, created_at);

create or replace function current_actor()
returns uuid language plpgsql stable set search_path = public as $$
declare v text;
begin
  if auth.uid() is not null then return auth.uid(); end if;
  v := nullif(current_setting('jlaero.actor_id', true), '');
  return v::uuid;
exception when others then return null;
end $$;

create or replace function log_trip_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into trip_events (trip_id, actor_id, kind, to_status, message, client_visible)
    values (new.id, current_actor(), 'status', new.status, 'Trip created', true);
  elsif new.status is distinct from old.status then
    insert into trip_events (trip_id, actor_id, kind, from_status, to_status, client_visible)
    values (new.id, current_actor(), 'status', old.status, new.status,
            new.status not in ('searching', 'quotes_received', 'broker_review', 'replacement_search'));
  end if;
  return new;
end $$;
create trigger trips_status_log after insert or update of status on trips
  for each row execute function log_trip_status();

-- ---------------------------------------------------------------------------
-- 6. RFQ rounds now hang off trips
-- ---------------------------------------------------------------------------
alter table rfqs add column trip_id uuid not null references trips(id) on delete cascade;
alter table rfqs add column purpose text not null default 'initial' check (purpose in ('initial', 'replacement'));
alter table rfqs add constraint rfqs_trip_round_key unique (trip_id, round);
create index rfqs_trip_idx on rfqs (trip_id);

-- ---------------------------------------------------------------------------
-- 7. Quotes: every operator response is a quote record (blueprint s7, s8)
-- ---------------------------------------------------------------------------
create type quote_source as enum ('api', 'email', 'website', 'manual', 'ai_extracted');
create type quote_availability as enum ('available', 'pending', 'unavailable', 'unknown');
create type trip_quote_status as enum (
  'pending_review',   -- AI extracted or just entered; broker has not verified
  'approved',         -- broker verified cost and availability
  'rejected',
  'option_sent',      -- presented to the client as one of up to three options
  'client_selected',
  'not_selected',     -- client picked another option
  'booked',           -- operator confirmed this aircraft for the trip
  'replaced',         -- was booked, then swapped after an operational issue
  'withdrawn',
  'expired'
);

create table trip_quotes (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references trips(id) on delete cascade,
  operator_id        uuid not null references operators(id) on delete restrict,
  aircraft_id        uuid references operator_aircraft(id) on delete set null,
  rfq_recipient_id   uuid references rfq_recipients(id) on delete set null,
  rfq_message_id     uuid references rfq_messages(id) on delete set null,
  source             quote_source not null,
  availability       quote_availability not null default 'unknown',
  -- aircraft as quoted
  aircraft_type      text not null,
  aircraft_category  aircraft_category,
  tail_number        text,
  year_mfr           int,
  passenger_capacity int,
  -- client-facing presentation
  headline           text,
  highlights         text[] not null default '{}',
  -- money: deterministic, computed by lib/trips/pricing.ts
  operator_cost      numeric(14,2) not null check (operator_cost >= 0),
  markup_pct         numeric(6,2) not null,
  markup_amount      numeric(14,2) not null,
  catering_cost      numeric(14,2) not null default 0,
  vehicle_cost       numeric(14,2) not null default 0,
  other_cost         numeric(14,2) not null default 0,
  other_cost_label   text,
  client_price       numeric(14,2) not null check (client_price >= 0),
  currency           text not null default 'USD',
  price_overridden   boolean not null default false,
  pricing_note       text,
  -- what the operator said, normalized
  operator_terms     jsonb not null default '{}'::jsonb,
  restrictions       text,
  expires_at         timestamptz,
  confidence         numeric(4,3),
  model              text,
  status             trip_quote_status not null default 'pending_review',
  option_rank        int check (option_rank between 1 and 3),
  is_replacement     boolean not null default false,
  reviewed_by        uuid references profiles(id) on delete set null,
  reviewed_at        timestamptz,
  sent_at            timestamptz,
  selected_at        timestamptz,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (abs(client_price - (operator_cost + markup_amount + catering_cost + vehicle_cost + other_cost)) < 0.01)
);
create index trip_quotes_trip_idx on trip_quotes (trip_id, status);
create index trip_quotes_operator_idx on trip_quotes (operator_id, created_at desc);
create trigger trip_quotes_updated before update on trip_quotes
  for each row execute function set_updated_at();
alter table trips add constraint trips_selected_quote_fk
  foreign key (selected_quote_id) references trip_quotes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 8. Operator bookings: confirmation tracking per booked aircraft (spec s12)
-- ---------------------------------------------------------------------------
create type operator_booking_status as enum ('pending', 'requested', 'confirmed', 'cancelled', 'replaced');

create table operator_bookings (
  id                   uuid primary key default gen_random_uuid(),
  trip_id              uuid not null references trips(id) on delete cascade,
  quote_id             uuid not null references trip_quotes(id) on delete restrict,
  operator_id          uuid not null references operators(id) on delete restrict,
  aircraft_type        text,
  tail_number          text,
  crew                 text,
  operator_contact     text,
  operator_email       text,
  operator_phone       text,
  confirmation_number  text,
  status               operator_booking_status not null default 'pending',
  requested_at         timestamptz,
  confirmed_at         timestamptz,
  notes                text,
  created_by           uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index operator_bookings_trip_idx on operator_bookings (trip_id, created_at desc);
create trigger operator_bookings_updated before update on operator_bookings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Contracts: versioned templates, immutable generated copies (s17, s18)
-- ---------------------------------------------------------------------------
create type template_status as enum ('draft', 'active', 'retired');
create type trip_contract_status as enum ('draft', 'sent', 'signed', 'void');

create table contract_templates (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null default 'Charter Agreement',
  version             int not null,
  effective_date      date not null default current_date,
  body                text not null,              -- markdown with {{placeholders}}
  document_path       text,                        -- optional source file in trip-docs storage
  status              template_status not null default 'draft',
  notes               text,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (name, version)
);
create unique index contract_templates_one_active on contract_templates (name) where status = 'active';

-- Active templates are frozen; publish a new version to change wording.
create or replace function freeze_contract_template()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and (new.body is distinct from old.body or new.version is distinct from old.version) then
    raise exception 'template v% is % and cannot be edited; create a new version', old.version, old.status;
  end if;
  return new;
end $$;
create trigger contract_templates_freeze before update on contract_templates
  for each row execute function freeze_contract_template();

insert into contract_templates (version, status, body, notes) values (1, 'active',
$tpl$# Charter Agreement

**Agreement number:** {{contract_number}}
**Trip:** {{trip_number}}
**Date issued:** {{issued_date}}

This Charter Agreement is between **{{company_legal_name}}** ("Broker"), acting as an air charter broker and agent for the Client, and **{{client_name}}**{{client_company_clause}} ("Client").

## 1. Flight

| | |
|---|---|
| Route | {{route}} |
| Departure | {{departure}} |
| Return | {{return}} |
| Passengers | {{passengers}} |
| Aircraft | {{aircraft}} |
| Operator (direct air carrier) | {{operator_name}} |

## 2. Services

{{services}}

## 3. Price

| | |
|---|---|
| Charter price | {{charter_price}} |
{{service_price_rows}}| **Total due** | **{{total_price}}** |

{{payment_terms}}

## 4. Broker disclosure

{{company_legal_name}} is an air charter broker and is not a direct air carrier. It does not own or operate the aircraft. The flight will be operated by {{operator_name}}, which holds operational control of the flight under its FAA Part 135 air carrier certificate.

## 5. Cancellation

{{cancellation_policy}}

## 6. Confirmation

The trip is confirmed only when this agreement is signed, payment in full has been received and verified by the Broker, and the operator has confirmed the aircraft. Pricing shown before that point is an estimate.

## 7. Special requests

{{special_requests}}

---

Signed electronically by the Client. By typing their name and selecting "Sign agreement", the Client agrees to be bound by this agreement and consents to sign electronically.
$tpl$,
'Placeholder wording until the company provides its contract template. Publish the company template as version 2.');

create table trip_contracts (
  id                 uuid primary key default gen_random_uuid(),
  contract_number    text not null unique,
  trip_id            uuid not null references trips(id) on delete cascade,
  client_id          uuid not null references clients(id) on delete restrict,
  quote_id           uuid not null references trip_quotes(id) on delete restrict,
  template_id        uuid not null references contract_templates(id) on delete restrict,
  template_version   int not null,
  rendered_body      text not null,               -- the exact text the client reviews and signs
  body_sha256        text not null,
  total_amount       numeric(14,2) not null,
  currency           text not null default 'USD',
  status             trip_contract_status not null default 'draft',
  signature_provider text not null default 'jlaero_click',  -- swap for an e-sign provider later
  provider_envelope_id text,
  sent_at            timestamptz,
  signer_name        text,
  signer_email       text,
  signer_ip          text,
  signer_user_agent  text,
  signed_at          timestamptz,
  signed_document_path text,
  voided_at          timestamptz,
  void_reason        text,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index trip_contracts_trip_idx on trip_contracts (trip_id, created_at desc);

create or replace function freeze_trip_contract()
returns trigger language plpgsql as $$
begin
  if old.status in ('sent', 'signed') and (new.rendered_body is distinct from old.rendered_body
      or new.total_amount is distinct from old.total_amount or new.body_sha256 is distinct from old.body_sha256) then
    raise exception 'contract % has been sent and its terms cannot change; void it and generate a new one', old.contract_number;
  end if;
  if old.status = 'signed' and new.status not in ('signed', 'void') then
    raise exception 'a signed contract can only be voided';
  end if;
  return new;
end $$;
create trigger trip_contracts_freeze before update on trip_contracts
  for each row execute function freeze_trip_contract();

-- ---------------------------------------------------------------------------
-- 10. Payments: client side and operator side kept apart (s19-s21)
-- ---------------------------------------------------------------------------
create type trip_payment_method as enum ('credit_card', 'ach', 'wire', 'direct_deposit');
create type trip_payment_status as enum ('pending', 'submitted', 'received', 'verified', 'failed', 'refunded', 'cancelled');
create type operator_payment_status as enum ('pending', 'sent', 'confirmed', 'failed', 'refunded', 'cancelled');

create table trip_payments (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  client_id        uuid not null references clients(id) on delete restrict,
  contract_id      uuid references trip_contracts(id) on delete set null,
  amount           numeric(14,2) not null check (amount > 0),
  currency         text not null default 'USD',
  method           trip_payment_method,
  status           trip_payment_status not null default 'pending',
  transaction_id   text,                          -- client or bank reference
  client_note      text,
  proof_path       text,                          -- storage path in trip-docs
  submitted_at     timestamptz,
  received_at      timestamptz,
  verified_at      timestamptz,
  verified_by      uuid references profiles(id) on delete set null,
  failure_reason   text,
  processor        text,                          -- null = manual; e.g. 'stripe' later
  processor_ref    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index trip_payments_trip_idx on trip_payments (trip_id);
create index trip_payments_status_idx on trip_payments (status);
create trigger trip_payments_updated before update on trip_payments
  for each row execute function set_updated_at();

create table operator_payments (
  id                     uuid primary key default gen_random_uuid(),
  trip_id                uuid not null references trips(id) on delete cascade,
  operator_id            uuid not null references operators(id) on delete restrict,
  operator_booking_id    uuid references operator_bookings(id) on delete set null,
  amount                 numeric(14,2) not null check (amount > 0),
  currency               text not null default 'USD',
  method                 trip_payment_method,
  status                 operator_payment_status not null default 'pending',
  payment_date           date,
  confirmation_reference text,
  proof_path             text,
  notes                  text,
  recorded_by            uuid references profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index operator_payments_trip_idx on operator_payments (trip_id);
create trigger operator_payments_updated before update on operator_payments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. Itineraries: operator originals and versioned company copies (s22, s23)
-- ---------------------------------------------------------------------------
create type itinerary_status as enum ('draft', 'published', 'superseded');

create table operator_itineraries (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references trips(id) on delete cascade,
  operator_booking_id uuid references operator_bookings(id) on delete set null,
  document_path       text,
  file_name           text,
  details             jsonb not null default '{}'::jsonb,   -- entered or extracted fields
  received_at         timestamptz not null default now(),
  uploaded_by         uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index operator_itineraries_trip_idx on operator_itineraries (trip_id, received_at desc);

create table client_itineraries (
  id                    uuid primary key default gen_random_uuid(),
  trip_id               uuid not null references trips(id) on delete cascade,
  version               int not null,
  operator_itinerary_id uuid references operator_itineraries(id) on delete set null,
  content               jsonb not null,           -- legs, aircraft, FBOs, crew, contacts
  change_summary        text,                     -- e.g. "Replacement aircraft: Challenger 650"
  status                itinerary_status not null default 'draft',
  published_at          timestamptz,
  sent_at               timestamptz,
  created_by            uuid references profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (trip_id, version)
);
create unique index client_itineraries_one_current on client_itineraries (trip_id) where status = 'published';

create or replace function freeze_client_itinerary()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and new.content is distinct from old.content then
    raise exception 'itinerary v% is % and cannot be edited; create a new version', old.version, old.status;
  end if;
  return new;
end $$;
create trigger client_itineraries_freeze before update on client_itineraries
  for each row execute function freeze_client_itinerary();

-- ---------------------------------------------------------------------------
-- 12. Operational issues / AOG (s17, s27)
-- ---------------------------------------------------------------------------
create type trip_issue_kind as enum ('aog', 'maintenance', 'mechanical', 'aircraft_unavailable', 'crew', 'weather', 'other');

create table trip_issues (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references trips(id) on delete cascade,
  kind          trip_issue_kind not null,
  description   text not null,
  reported_via  text not null default 'broker',  -- broker, operator_email, operator_api, tracking
  reported_by   uuid references profiles(id) on delete set null,
  previous_status trip_status,
  resolved_at   timestamptz,
  resolution    text,
  resolved_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index trip_issues_open_idx on trip_issues (trip_id) where resolved_at is null;

-- ---------------------------------------------------------------------------
-- 13. Notifications (s24). One row per recipient per channel.
-- ---------------------------------------------------------------------------
create type notification_channel as enum ('app', 'email', 'sms', 'push');
create type notification_status as enum ('pending', 'sent', 'failed', 'skipped');

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  client_id   uuid references clients(id) on delete cascade,
  to_address  text,                               -- email or phone when there is no account
  trip_id     uuid references trips(id) on delete cascade,
  type        text not null,                      -- NEW_QUOTE, CLIENT_SELECTED, 72_HOUR_REMINDER, ...
  channel     notification_channel not null,
  audience    text not null check (audience in ('client', 'staff')),
  title       text not null,
  message     text not null,
  link        text,
  status      notification_status not null default 'pending',
  error       text,
  attempts    int not null default 0,
  sent_at     timestamptz,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_pending_idx on notifications (created_at) where status = 'pending';
create index notifications_trip_idx on notifications (trip_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 14. Feedback (s21)
-- ---------------------------------------------------------------------------
create table trip_feedback (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null unique references trips(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comments    text,
  categories  jsonb not null default '{}'::jsonb,  -- {"booking": 5, "communication": 4, ...}
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 15. RLS. Staff work through the server (service connection after a role
-- check) and also get direct policies; clients see only their own records.
-- ---------------------------------------------------------------------------
alter table clients              enable row level security;
alter table staff_notes          enable row level security;
alter table operator_aircraft    enable row level security;
alter table trips                enable row level security;
alter table trip_events          enable row level security;
alter table trip_quotes          enable row level security;
alter table operator_bookings    enable row level security;
alter table contract_templates   enable row level security;
alter table trip_contracts       enable row level security;
alter table trip_payments        enable row level security;
alter table operator_payments    enable row level security;
alter table operator_itineraries enable row level security;
alter table client_itineraries   enable row level security;
alter table trip_issues          enable row level security;
alter table notifications        enable row level security;
alter table trip_feedback        enable row level security;

create policy "staff manages clients" on clients for all to authenticated
  using ((select is_staff())) with check ((select is_broker()));
create policy "client reads self" on clients for select to authenticated
  using (user_id = (select auth.uid()));

create policy "staff notes" on staff_notes for all to authenticated
  using ((select is_staff())) with check ((select is_staff()));

-- Operators: brokers read and edit, only admins add or remove (blueprint s2).
drop policy if exists "admin manages operators" on operators;
create policy "staff reads operators" on operators for select to authenticated using ((select is_staff()));
create policy "broker edits operators" on operators for update to authenticated
  using ((select is_broker())) with check ((select is_broker()));
create policy "admin adds operators" on operators for insert to authenticated with check ((select is_admin()));
create policy "admin removes operators" on operators for delete to authenticated using ((select is_admin()));
drop policy if exists "admin manages operator contacts" on operator_contacts;
create policy "broker manages operator contacts" on operator_contacts for all to authenticated
  using ((select is_broker())) with check ((select is_broker()));
create policy "staff reads operator aircraft" on operator_aircraft for select to authenticated using ((select is_staff()));
create policy "broker edits operator aircraft" on operator_aircraft for all to authenticated
  using ((select is_broker())) with check ((select is_broker()));

drop policy if exists "admin manages rfqs" on rfqs;
drop policy if exists "admin manages rfq recipients" on rfq_recipients;
drop policy if exists "admin manages rfq messages" on rfq_messages;
create policy "broker manages rfqs" on rfqs for all to authenticated using ((select is_broker())) with check ((select is_broker()));
create policy "broker manages rfq recipients" on rfq_recipients for all to authenticated using ((select is_broker())) with check ((select is_broker()));
create policy "broker manages rfq messages" on rfq_messages for all to authenticated using ((select is_broker())) with check ((select is_broker()));

create policy "staff reads trips" on trips for select to authenticated using ((select is_staff()));
create policy "broker edits trips" on trips for all to authenticated
  using ((select is_broker())) with check ((select is_broker()));
create policy "client reads own trips" on trips for select to authenticated
  using (exists (select 1 from clients c where c.id = client_id and c.user_id = (select auth.uid())));

create policy "staff reads events" on trip_events for select to authenticated using ((select is_staff()));
create policy "client reads visible events" on trip_events for select to authenticated
  using (client_visible and (select owns_trip(trip_id)));

-- trip_quotes: clients get a column subset only (no cost, markup, operator).
revoke all on trip_quotes from anon, authenticated;
grant select (id, trip_id, status, option_rank, is_replacement, availability, aircraft_type, aircraft_category,
              year_mfr, passenger_capacity, headline, highlights, client_price, currency, expires_at, sent_at, selected_at)
  on trip_quotes to authenticated;
create policy "client reads presented options" on trip_quotes for select to authenticated
  using (status in ('option_sent', 'client_selected', 'not_selected', 'booked', 'expired')
         and sent_at is not null and (select owns_trip(trip_id)));

create policy "staff reads operator bookings" on operator_bookings for select to authenticated using ((select is_staff()));
create policy "broker manages operator bookings" on operator_bookings for all to authenticated
  using ((select is_broker())) with check ((select is_broker()));

create policy "staff reads templates" on contract_templates for select to authenticated using ((select is_staff()));
create policy "admin manages templates" on contract_templates for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

create policy "staff reads contracts" on trip_contracts for select to authenticated using ((select is_staff()));
create policy "client reads own contracts" on trip_contracts for select to authenticated
  using (status in ('sent', 'signed', 'void') and (select owns_trip(trip_id)));

create policy "staff reads payments" on trip_payments for select to authenticated using ((select is_staff()));
create policy "client reads own payments" on trip_payments for select to authenticated
  using ((select owns_trip(trip_id)));

-- Operator payments are finance data; brokers see status only via the app.
create policy "finance manages operator payments" on operator_payments for all to authenticated
  using ((select is_finance())) with check ((select is_finance()));
create policy "broker reads operator payments" on operator_payments for select to authenticated using ((select is_broker()));

create policy "staff reads operator itineraries" on operator_itineraries for select to authenticated using ((select is_staff()));
create policy "staff reads client itineraries" on client_itineraries for select to authenticated using ((select is_staff()));
create policy "client reads current itinerary" on client_itineraries for select to authenticated
  using (status = 'published' and (select owns_trip(trip_id)));

create policy "staff reads issues" on trip_issues for select to authenticated using ((select is_staff()));

create policy "user reads own notifications" on notifications for select to authenticated
  using (user_id = (select auth.uid()) and channel = 'app');
create policy "user marks own notifications read" on notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "staff reads feedback" on trip_feedback for select to authenticated using ((select is_staff()));
create policy "client reads own feedback" on trip_feedback for select to authenticated using ((select owns_trip(trip_id)));

-- ---------------------------------------------------------------------------
-- 16. Client actions. The only ways a client changes workflow state.
-- ---------------------------------------------------------------------------

-- Find or create the caller's client record, linking an email-only record
-- that matches their verified account email.
create or replace function ensure_my_client(p_full_name text, p_phone text, p_company text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'sign in required'; end if;
  select id into v_id from clients where user_id = v_uid;
  if v_id is null then
    select email into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
    if v_email is null then raise exception 'please verify your email address first'; end if;
    update clients set user_id = v_uid where lower(email) = lower(v_email) and user_id is null returning id into v_id;
  end if;
  if v_id is null then
    insert into clients (user_id, full_name, email, phone, company_name)
    values (v_uid, coalesce(nullif(trim(p_full_name), ''), v_email), v_email, nullif(trim(p_phone), ''), nullif(trim(p_company), ''))
    returning id into v_id;
  else
    update clients set
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      company_name = coalesce(nullif(trim(p_company), ''), company_name)
    where id = v_id;
  end if;
  return v_id;
end $$;

-- The questionnaire (spec s3 step 2). Times are local to each airport; the
-- server resolves them to instants (p_depart_at, p_return_at) using the
-- airport time zone.
create or replace function create_trip_request(
  p_full_name text, p_phone text, p_company text,
  p_origin text, p_destination text,
  p_departure_date date, p_departure_time time, p_depart_at timestamptz,
  p_return_date date, p_return_time time, p_return_at timestamptz,
  p_passengers int, p_aircraft_category aircraft_category, p_aircraft_preference text,
  p_vehicle boolean, p_catering boolean, p_first_time boolean, p_special_requests text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_trip uuid;
  v_radius numeric;
begin
  v_client := ensure_my_client(p_full_name, p_phone, p_company);
  if p_origin = p_destination then raise exception 'origin and destination must differ'; end if;
  if p_depart_at < now() + interval '2 hours' then raise exception 'departure must be at least 2 hours from now'; end if;
  select coalesce((value->>'radius_miles')::numeric, 100) into v_radius from app_settings where key = 'search';
  update clients set first_time_private_flyer = coalesce(p_first_time, first_time_private_flyer) where id = v_client;
  insert into trips (client_id, source, origin_icao, destination_icao, departure_date, departure_time, depart_at,
                     return_date, return_time, return_at, passengers, aircraft_category, aircraft_preference,
                     vehicle_required, catering_required, first_time_flyer, special_requests, search_radius_miles, created_by)
  values (v_client, 'app', upper(p_origin), upper(p_destination), p_departure_date, p_departure_time, p_depart_at,
          p_return_date, p_return_time, p_return_at, p_passengers, p_aircraft_category, nullif(trim(p_aircraft_preference), ''),
          coalesce(p_vehicle, false), coalesce(p_catering, false), p_first_time, nullif(trim(p_special_requests), ''),
          coalesce(v_radius, 100), auth.uid())
  returning id into v_trip;
  return v_trip;
end $$;

-- "Select This Aircraft" (spec s8, blueprint s16).
create or replace function select_trip_option(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  q trip_quotes%rowtype;
  t trips%rowtype;
begin
  select * into q from trip_quotes where id = p_quote_id for update;
  if not found then raise exception 'option not found'; end if;
  select * into t from trips where id = q.trip_id for update;
  if not owns_trip(t.id) then raise exception 'not your trip'; end if;
  if t.status not in ('options_sent', 'replacement_pending_client') then raise exception 'this trip is not waiting for a selection'; end if;
  if q.status <> 'option_sent' then raise exception 'this option is no longer available'; end if;
  if q.expires_at is not null and q.expires_at < now() then
    update trip_quotes set status = 'expired' where id = q.id;
    raise exception 'this option has expired; your broker will refresh it';
  end if;
  update trip_quotes set status = 'client_selected', selected_at = now() where id = q.id;
  update trip_quotes set status = 'not_selected'
    where trip_id = t.id and id <> q.id and status = 'option_sent' and is_replacement = q.is_replacement;
  update trips set status = 'client_selected', selected_quote_id = q.id where id = t.id;
  insert into trip_events (trip_id, actor_id, kind, message, meta, client_visible)
  values (t.id, auth.uid(), 'quote', 'Client selected ' || coalesce(q.headline, q.aircraft_type),
          jsonb_build_object('quote_id', q.id, 'client_price', q.client_price, 'replacement', q.is_replacement), true);
  insert into audit_logs (actor_id, action, target_type, target_id, new_value)
  values (auth.uid(), 'quote.client_selected', 'trip_quote', q.id::text, jsonb_build_object('client_price', q.client_price));
end $$;

-- Review -> Sign -> Submit (spec s9). Click-to-sign with an audit trail:
-- typed name, time, IP, user agent, and the hash of the exact text signed.
create or replace function sign_trip_contract(p_contract_id uuid, p_signer_name text, p_body_sha256 text, p_ip text, p_user_agent text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c trip_contracts%rowtype;
  t trips%rowtype;
  v_email text;
  v_payment uuid;
begin
  select * into c from trip_contracts where id = p_contract_id for update;
  if not found then raise exception 'contract not found'; end if;
  select * into t from trips where id = c.trip_id for update;
  if not owns_trip(t.id) then raise exception 'not your contract'; end if;
  if c.status <> 'sent' or t.status <> 'contract_sent' then raise exception 'this contract is not awaiting signature'; end if;
  if c.body_sha256 <> p_body_sha256 then raise exception 'the contract changed while you were reviewing it; please reload'; end if;
  if length(trim(coalesce(p_signer_name, ''))) < 3 then raise exception 'type your full name to sign'; end if;
  select email into v_email from auth.users where id = auth.uid();

  update trip_contracts set status = 'signed', signed_at = now(), signer_name = trim(p_signer_name),
    signer_email = v_email, signer_ip = p_ip, signer_user_agent = left(p_user_agent, 500)
  where id = c.id;
  update trips set status = 'contract_signed' where id = t.id;

  -- Payment is enabled by signature (blueprint s18).
  insert into trip_payments (trip_id, client_id, contract_id, amount, currency, status)
  values (t.id, c.client_id, c.id, c.total_amount, c.currency, 'pending')
  returning id into v_payment;
  update trips set status = 'payment_pending' where id = t.id;

  insert into audit_logs (actor_id, action, target_type, target_id, new_value, meta)
  values (auth.uid(), 'contract.signed', 'trip_contract', c.id::text,
          jsonb_build_object('signer_name', trim(p_signer_name), 'signed_at', now()),
          jsonb_build_object('ip', p_ip, 'sha256', c.body_sha256, 'contract_number', c.contract_number));
  return v_payment;
end $$;

-- Client reports how they paid (manual methods; blueprint s19, s20).
create or replace function submit_trip_payment(p_payment_id uuid, p_method trip_payment_method, p_reference text, p_note text, p_proof_path text)
returns void language plpgsql security definer set search_path = public as $$
declare p trip_payments%rowtype;
begin
  select * into p from trip_payments where id = p_payment_id for update;
  if not found or not owns_trip(p.trip_id) then raise exception 'payment not found'; end if;
  if p.status not in ('pending', 'failed') then raise exception 'this payment has already been submitted'; end if;
  if p_proof_path is not null and p_proof_path not like p.trip_id::text || '/client/%' then
    raise exception 'invalid proof upload path';
  end if;
  update trip_payments set method = p_method, transaction_id = nullif(trim(p_reference), ''),
    client_note = nullif(trim(p_note), ''), proof_path = p_proof_path,
    status = 'submitted', submitted_at = now(), failure_reason = null
  where id = p.id;
  insert into trip_events (trip_id, actor_id, kind, message, meta, client_visible)
  values (p.trip_id, auth.uid(), 'payment', 'Client submitted payment by ' || replace(p_method::text, '_', ' '),
          jsonb_build_object('payment_id', p.id, 'amount', p.amount), true);
end $$;

-- Rating and comments after the trip (spec s21).
create or replace function submit_trip_feedback(p_trip_id uuid, p_rating int, p_comments text, p_categories jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t trips%rowtype;
begin
  select * into t from trips where id = p_trip_id for update;
  if not found or not owns_trip(t.id) then raise exception 'trip not found'; end if;
  if t.status not in ('completed', 'feedback_requested') then raise exception 'feedback opens once the trip is completed'; end if;
  insert into trip_feedback (trip_id, client_id, rating, comments, categories)
  values (t.id, t.client_id, p_rating, nullif(trim(p_comments), ''), coalesce(p_categories, '{}'::jsonb));
  update trips set status = 'closed', closed_at = now() where id = t.id;
  insert into trip_events (trip_id, actor_id, kind, message, meta, client_visible)
  values (t.id, auth.uid(), 'feedback', 'Client left a ' || p_rating || '-star rating', jsonb_build_object('rating', p_rating), false);
end $$;

revoke all on function ensure_my_client(text, text, text) from public, anon;
revoke all on function create_trip_request(text, text, text, text, text, date, time, timestamptz, date, time, timestamptz, int, aircraft_category, text, boolean, boolean, boolean, text) from public, anon;
revoke all on function select_trip_option(uuid) from public, anon;
revoke all on function sign_trip_contract(uuid, text, text, text, text) from public, anon;
revoke all on function submit_trip_payment(uuid, trip_payment_method, text, text, text) from public, anon;
revoke all on function submit_trip_feedback(uuid, int, text, jsonb) from public, anon;
grant execute on function ensure_my_client(text, text, text) to authenticated;
grant execute on function create_trip_request(text, text, text, text, text, date, time, timestamptz, date, time, timestamptz, int, aircraft_category, text, boolean, boolean, boolean, text) to authenticated;
grant execute on function select_trip_option(uuid) to authenticated;
grant execute on function sign_trip_contract(uuid, text, text, text, text) to authenticated;
grant execute on function submit_trip_payment(uuid, trip_payment_method, text, text, text) to authenticated;
grant execute on function submit_trip_feedback(uuid, int, text, jsonb) to authenticated;
revoke all on function current_actor() from public, anon;
revoke all on function next_trip_number() from public, anon;

-- ---------------------------------------------------------------------------
-- 17. Document storage: private bucket, one folder per trip.
--   <trip_id>/client/...   client uploads (payment proof); client can read
--   <trip_id>/staff/...    operator itineraries, signed PDFs; staff only
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('trip-docs', 'trip-docs', false)
on conflict (id) do nothing;

create policy "staff reads trip docs" on storage.objects for select to authenticated
  using (bucket_id = 'trip-docs' and (select is_staff()));
create policy "staff writes trip docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-docs' and (select is_staff()));
-- Path check without casting inside the policy: other buckets use non-uuid
-- folder names, and policy predicates are not guaranteed to short-circuit.
create or replace function owns_trip_client_path(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/');
begin
  if p_bucket <> 'trip-docs' or array_length(parts, 1) < 3 or parts[2] <> 'client' then return false; end if;
  return owns_trip(parts[1]::uuid);
exception when invalid_text_representation then return false;
end $$;
grant execute on function owns_trip_client_path(text, text) to authenticated;

create policy "client reads own trip client docs" on storage.objects for select to authenticated
  using ((select owns_trip_client_path(bucket_id, name)));
create policy "client uploads own trip client docs" on storage.objects for insert to authenticated
  with check ((select owns_trip_client_path(bucket_id, name)));

-- ---------------------------------------------------------------------------
-- 18. Housekeeping sweep (time-driven steps with no email live in the app
-- cron at /api/cron/trips; this one only expires stale records).
-- ---------------------------------------------------------------------------
create or replace function run_trip_expiries()
returns void language plpgsql security definer set search_path = public as $$
begin
  update trip_quotes set status = 'expired'
    where status in ('pending_review', 'approved', 'option_sent') and expires_at is not null and expires_at < now();
  update rfq_recipients set status = 'no_response' where status = 'sent' and sent_at < now() - interval '72 hours';
end $$;
revoke execute on function run_trip_expiries() from public, anon, authenticated;
grant execute on function run_trip_expiries() to service_role;
select cron.schedule('jlaero-trip-expiries', '*/30 * * * *', $$select public.run_trip_expiries()$$);

-- Realtime: clients watch their trip and notifications update live.
alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table notifications;
