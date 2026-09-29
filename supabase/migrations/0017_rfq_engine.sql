-- AI-driven sourcing engine (leadership direction 2026-09-12).
-- A traveler files a trip request. Ops (or the engine) selects operators,
-- drafts one RFQ email per operator, sends them, parses replies into
-- operator_quotes, prices them with a flexible markup into traveler_offers,
-- and on acceptance a booking is created with Jlaero as provider of record.

create type trip_request_status as enum ('open', 'sourcing', 'offers_ready', 'accepted', 'booked', 'closed', 'expired');
create type rfq_recipient_status as enum ('draft', 'approved', 'sent', 'bounced', 'replied', 'declined', 'quoted', 'no_response');
create type rfq_direction as enum ('outbound', 'inbound');
create type rfq_message_kind as enum ('rfq', 'quote', 'decline', 'question', 'auto_reply', 'confirmation', 'other', 'unknown');
create type operator_quote_status as enum ('pending_review', 'approved', 'rejected', 'expired');
create type offer_tier as enum ('value', 'preferred', 'premium');
create type offer_status as enum ('draft', 'presented', 'accepted', 'expired', 'withdrawn');
create type pricing_strategy as enum ('target_margin', 'beat_competitor', 'manual');

-- ---------------------------------------------------------------------------
-- Trip requests (request-first brokerage; no aircraft chosen up front)
-- ---------------------------------------------------------------------------
create table trip_requests (
  id                 uuid primary key default gen_random_uuid(),
  traveler_id        uuid not null references profiles(id) on delete cascade,
  origin_icao        text not null references airports(icao),
  destination_icao   text not null references airports(icao),
  depart_at          timestamptz not null,
  return_at          timestamptz,
  passengers         int not null check (passengers between 1 and 19),
  category_pref      aircraft_category,
  notes              text,
  sourcing_radius_nm numeric(6,1) not null default 150,
  status             trip_request_status not null default 'open',
  booking_id         uuid references bookings(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index trip_requests_traveler_idx on trip_requests (traveler_id, created_at desc);
create index trip_requests_status_idx on trip_requests (status);
create trigger trip_requests_updated before update on trip_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RFQ rounds, recipients, messages
-- ---------------------------------------------------------------------------
create table rfqs (
  id              uuid primary key default gen_random_uuid(),
  trip_request_id uuid not null references trip_requests(id) on delete cascade,
  round           int not null default 1,
  created_by      uuid references profiles(id) on delete set null,
  deadline_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (trip_request_id, round)
);

create table rfq_recipients (
  id                  uuid primary key default gen_random_uuid(),
  rfq_id              uuid not null references rfqs(id) on delete cascade,
  operator_id         uuid not null references operators(id) on delete cascade,
  contact_id          uuid references operator_contacts(id) on delete set null,
  to_email            text,
  reply_token         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status              rfq_recipient_status not null default 'draft',
  subject             text,
  body_text           text,
  draft_model         text,
  match_reason        text,                    -- why this operator was picked
  approved_by         uuid references profiles(id) on delete set null,
  approved_at         timestamptz,
  provider_message_id text,
  sent_at             timestamptz,
  last_event_at       timestamptz,
  created_at          timestamptz not null default now(),
  unique (rfq_id, operator_id)
);
create index rfq_recipients_status_idx on rfq_recipients (status);

create table rfq_messages (
  id                  uuid primary key default gen_random_uuid(),
  rfq_id              uuid references rfqs(id) on delete cascade,
  recipient_id        uuid references rfq_recipients(id) on delete set null,
  direction           rfq_direction not null,
  kind                rfq_message_kind not null default 'unknown',
  provider_message_id text,
  in_reply_to         text,
  from_address        text,
  to_address          text,
  subject             text,
  text_body           text,
  html_body           text,
  headers             jsonb not null default '{}'::jsonb,
  raw                 jsonb,
  classification      jsonb,                   -- model output for inbound
  received_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index rfq_messages_rfq_idx on rfq_messages (rfq_id, created_at);
create index rfq_messages_recipient_idx on rfq_messages (recipient_id);
create unique index rfq_messages_provider_id_idx on rfq_messages (provider_message_id) where provider_message_id is not null;

-- ---------------------------------------------------------------------------
-- Parsed operator quotes
-- ---------------------------------------------------------------------------
create table operator_quotes (
  id             uuid primary key default gen_random_uuid(),
  rfq_id         uuid not null references rfqs(id) on delete cascade,
  recipient_id   uuid references rfq_recipients(id) on delete set null,
  message_id     uuid references rfq_messages(id) on delete set null,
  operator_id    uuid not null references operators(id) on delete cascade,
  extracted      jsonb not null,               -- full structured extraction
  all_in_total   numeric(14,2),
  currency       text not null default 'USD',
  aircraft_type  text,
  tail_number    text,
  fet_included   boolean,
  expires_at     timestamptz,
  confidence     numeric(4,3),
  model          text,
  status         operator_quote_status not null default 'pending_review',
  reviewed_by    uuid references profiles(id) on delete set null,
  reviewed_at    timestamptz,
  review_notes   text,
  created_at     timestamptz not null default now()
);
create index operator_quotes_rfq_idx on operator_quotes (rfq_id);
create index operator_quotes_status_idx on operator_quotes (status);

-- ---------------------------------------------------------------------------
-- Pricing: flexible by policy. Defaults per tier; every offer stores the
-- markup actually used, and can undercut a known competitor price down to
-- the minimum margin.
-- ---------------------------------------------------------------------------
create table pricing_policies (
  tier               offer_tier primary key,
  label              text not null,
  description        text not null,
  default_markup_pct numeric(5,2) not null,    -- applied to operator cost
  min_margin_pct     numeric(5,2) not null,    -- floor when beating a competitor
  min_margin_abs     numeric(12,2) not null default 0,
  beat_competitor_by_pct numeric(5,2) not null default 3,
  round_to           numeric(8,2) not null default 50,
  active             boolean not null default true,
  updated_at         timestamptz not null default now()
);
create trigger pricing_policies_updated before update on pricing_policies
  for each row execute function set_updated_at();

insert into pricing_policies (tier, label, description, default_markup_pct, min_margin_pct, min_margin_abs) values
  ('value',     'Value',     'Lowest all-in price that fits the trip. Well-kept aircraft, standard cabin.',            12, 6, 300),
  ('preferred', 'Preferred', 'Newer aircraft, higher safety rating, flexible changes. Our recommended tier.',          18, 8, 500),
  ('premium',   'Premium',   'Top-of-category cabin, ARGUS Platinum or Wyvern Wingman operator, priority handling.', 25, 10, 800);

create table traveler_offers (
  id                uuid primary key default gen_random_uuid(),
  trip_request_id   uuid not null references trip_requests(id) on delete cascade,
  operator_quote_id uuid not null references operator_quotes(id) on delete cascade,
  tier              offer_tier not null,
  headline          text not null,             -- e.g. "Citation XLS, 8 seats, 2019"
  includes          text[] not null default '{}',
  operator_cost     numeric(14,2) not null,
  markup_pct        numeric(6,2) not null,
  markup_abs        numeric(14,2) not null,
  traveler_price    numeric(14,2) not null,
  currency          text not null default 'USD',
  strategy          pricing_strategy not null default 'target_margin',
  competitor_price  numeric(14,2),
  competitor_source text,
  expires_at        timestamptz,
  status            offer_status not null default 'draft',
  presented_at      timestamptz,
  accepted_at       timestamptz,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (trip_request_id, tier, operator_quote_id)
);
create index traveler_offers_request_idx on traveler_offers (trip_request_id, status);

-- Bookings created from an accepted offer have no listed aircraft; Jlaero is
-- the provider of record (broker) and the operator is named on the offer.
alter table bookings add column trip_request_id uuid references trip_requests(id) on delete set null;
alter table bookings add column traveler_offer_id uuid references traveler_offers(id) on delete set null;
alter table bookings drop constraint bookings_check;
alter table bookings add constraint bookings_check check (
  (kind = 'charter' and (aircraft_id is not null or trip_request_id is not null)) or
  (kind = 'crew' and crew_profile_id is not null)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table trip_requests    enable row level security;
alter table rfqs             enable row level security;
alter table rfq_recipients   enable row level security;
alter table rfq_messages     enable row level security;
alter table operator_quotes  enable row level security;
alter table pricing_policies enable row level security;
alter table traveler_offers  enable row level security;

create policy "traveler reads own requests" on trip_requests for select to authenticated
  using (traveler_id = (select auth.uid()) or (select is_admin()));
create policy "traveler files request" on trip_requests for insert to authenticated
  with check (traveler_id = (select auth.uid()) and status = 'open');
create policy "traveler closes own request" on trip_requests for update to authenticated
  using (traveler_id = (select auth.uid()) or (select is_admin()))
  with check (traveler_id = (select auth.uid()) or (select is_admin()));

create policy "admin manages rfqs" on rfqs for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "admin manages rfq recipients" on rfq_recipients for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "admin manages rfq messages" on rfq_messages for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "admin manages operator quotes" on operator_quotes for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "anyone reads pricing tiers" on pricing_policies for select to authenticated using (true);
create policy "admin edits pricing" on pricing_policies for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- Travelers only ever see presented or accepted offers on their own request,
-- and never the operator cost or markup columns (view below).
create policy "admin manages offers" on traveler_offers for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "traveler reads presented offers" on traveler_offers for select to authenticated
  using (
    status in ('presented', 'accepted', 'expired')
    and exists (select 1 from trip_requests t where t.id = trip_request_id and t.traveler_id = (select auth.uid()))
  );

create view traveler_offer_cards with (security_invoker = true) as
  select o.id, o.trip_request_id, o.tier, o.headline, o.includes, o.traveler_price, o.currency,
         o.expires_at, o.status, o.presented_at, o.accepted_at,
         p.label as tier_label, p.description as tier_description,
         q.aircraft_type, q.fet_included
  from traveler_offers o
  join pricing_policies p on p.tier = o.tier
  join operator_quotes q on q.id = o.operator_quote_id;
grant select on traveler_offer_cards to authenticated;

-- ---------------------------------------------------------------------------
-- Accepting an offer: the traveler calls this; it freezes the price into a
-- booking + accepted quote so the existing contract and payment flow runs.
-- Jlaero's platform account is the provider of record.
-- ---------------------------------------------------------------------------
create or replace function platform_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select r.user_id from user_roles r join profiles p on p.id = r.user_id where r.role = 'admin' order by p.created_at limit 1;
$$;

create or replace function accept_traveler_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_offer traveler_offers%rowtype;
  v_req   trip_requests%rowtype;
  v_quote operator_quotes%rowtype;
  v_booking_id uuid;
  v_quote_id uuid;
  v_provider uuid;
begin
  select * into v_offer from traveler_offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'presented' then
    raise exception 'offer is not open for acceptance';
  end if;
  if v_offer.expires_at is not null and v_offer.expires_at < now() then
    update traveler_offers set status = 'expired' where id = p_offer_id;
    raise exception 'offer has expired';
  end if;
  select * into v_req from trip_requests where id = v_offer.trip_request_id for update;
  if v_req.traveler_id <> auth.uid() then
    raise exception 'not your request';
  end if;
  if v_req.status not in ('offers_ready', 'sourcing') then
    raise exception 'request is no longer open';
  end if;
  select * into v_quote from operator_quotes where id = v_offer.operator_quote_id;

  v_provider := coalesce((select profile_id from operators where id = v_quote.operator_id), platform_profile_id());
  if v_provider is null then
    raise exception 'no platform account configured';
  end if;

  insert into bookings (kind, status, buyer_id, provider_id, currency, quoted_price, trip_request_id, traveler_offer_id, notes,
                        occupied_from, occupied_to)
  values ('charter', 'accepted', v_req.traveler_id, v_provider, v_offer.currency, v_offer.traveler_price,
          v_req.id, v_offer.id, v_req.notes, v_req.depart_at, coalesce(v_req.return_at, v_req.depart_at + interval '1 day'))
  returning id into v_booking_id;

  insert into booking_legs (booking_id, position, origin, destination, depart_at, passengers)
  values (v_booking_id, 0, v_req.origin_icao, v_req.destination_icao, v_req.depart_at, v_req.passengers);
  if v_req.return_at is not null then
    insert into booking_legs (booking_id, position, origin, destination, depart_at, passengers)
    values (v_booking_id, 1, v_req.destination_icao, v_req.origin_icao, v_req.return_at, v_req.passengers);
  end if;

  insert into quotes (booking_id, version, created_by, status, currency, total, expires_at, notes)
  values (v_booking_id, 1, v_provider, 'accepted', v_offer.currency, v_offer.traveler_price, null,
          v_offer.headline || '. All-in price arranged by Jlaero as your charter broker.')
  returning id into v_quote_id;
  insert into quote_line_items (quote_id, kind, description, quantity, unit_amount, amount, position)
  values (v_quote_id, 'flight_time', v_offer.headline || ' (all-in charter)', 1, v_offer.traveler_price, v_offer.traveler_price, 0);

  update bookings set accepted_quote_id = v_quote_id where id = v_booking_id;
  update traveler_offers set status = 'accepted', accepted_at = now() where id = p_offer_id;
  update traveler_offers set status = 'withdrawn' where trip_request_id = v_req.id and id <> p_offer_id and status = 'presented';
  update trip_requests set status = 'accepted', booking_id = v_booking_id where id = v_req.id;

  insert into audit_logs (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), 'offer.accepted', 'traveler_offer', p_offer_id::text,
          jsonb_build_object('booking_id', v_booking_id, 'traveler_price', v_offer.traveler_price, 'operator_cost', v_offer.operator_cost));
  return v_booking_id;
end $$;
revoke all on function accept_traveler_offer(uuid) from public;
grant execute on function accept_traveler_offer(uuid) to authenticated;
revoke all on function platform_profile_id() from public;
grant execute on function platform_profile_id() to authenticated, service_role;

-- Expiry sweep additions
create or replace function run_sourcing_expiries()
returns void language plpgsql security definer set search_path = public as $$
begin
  update traveler_offers set status = 'expired' where status = 'presented' and expires_at is not null and expires_at < now();
  update operator_quotes set status = 'expired' where status in ('pending_review', 'approved') and expires_at is not null and expires_at < now();
  update rfq_recipients set status = 'no_response' where status = 'sent' and sent_at < now() - interval '72 hours';
  update trip_requests set status = 'expired' where status in ('open', 'sourcing', 'offers_ready') and depart_at < now();
end $$;
revoke execute on function run_sourcing_expiries() from public, anon;
grant execute on function run_sourcing_expiries() to service_role;
select cron.schedule('jlaero-sourcing-expiries', '*/30 * * * *', $$select public.run_sourcing_expiries()$$);
