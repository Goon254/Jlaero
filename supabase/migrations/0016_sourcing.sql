-- Sourcing layer for the AI-assisted brokerage (leadership direction, 2026-09).
-- Three concerns, kept separate on purpose:
--   1. registry_aircraft: every US business aircraft from the FAA registry
--      (public bulk data). Gives tail number, Mode S hex, type, seats,
--      registrant. No emails exist in this data.
--   2. aircraft_positions: last known ADS-B position per hex, refreshed by a
--      poller. Used to answer "which jets are on the ground near KXXX now".
--   3. operators + operator_contacts: the Part 135 charter operators and
--      management companies we actually send RFQs to. Contacts are business
--      contacts with an explicit opt-out record (CAN-SPAM).
-- All three are ops-only tables: service role writes, admins read.

create type registrant_kind as enum ('company', 'trust', 'individual', 'government', 'unknown');
create type contact_source as enum ('manual', 'website', 'faa_part135', 'directory', 'enrichment', 'inbound');
create type outreach_status as enum ('new', 'contacted', 'responsive', 'partner', 'declined', 'do_not_contact');

create table registry_aircraft (
  n_number        text primary key,               -- without the leading N
  icao_hex        text not null,                  -- Mode S code, lowercase hex
  serial_number   text,
  mfr_model_code  text,
  manufacturer    text,
  model           text,
  category        aircraft_category,              -- derived heuristically
  seats           int,
  year_mfr        int,
  engine_type     text,                           -- turbofan | turbojet | turboprop
  registrant_name text,
  registrant_kind registrant_kind not null default 'unknown',
  registrant_city text,
  registrant_state text,
  registrant_zip  text,
  registrant_country text,
  status_code     text,
  operator_id     uuid,                           -- set once we map the aircraft to a charter operator
  source          text not null default 'faa_releasable',
  imported_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index registry_aircraft_hex_idx on registry_aircraft (icao_hex);
create index registry_aircraft_state_idx on registry_aircraft (registrant_state);
create index registry_aircraft_category_idx on registry_aircraft (category);
create index registry_aircraft_operator_idx on registry_aircraft (operator_id);
create trigger registry_aircraft_updated before update on registry_aircraft
  for each row execute function set_updated_at();

create table aircraft_positions (
  icao_hex     text primary key,
  n_number     text,
  latitude     double precision not null,
  longitude    double precision not null,
  on_ground    boolean not null default false,
  altitude_ft  int,
  ground_speed_kt numeric(6,1),
  nearest_icao text references airports(icao),
  nearest_nm   numeric(7,2),
  seen_at      timestamptz not null,
  source       text not null,                     -- adsb.lol | adsb.fi | adsbexchange | aeroapi
  updated_at   timestamptz not null default now()
);
create index aircraft_positions_nearest_idx on aircraft_positions (nearest_icao) where on_ground;
create index aircraft_positions_seen_idx on aircraft_positions (seen_at desc);

create table operators (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  legal_name         text,
  certificate_number text,                        -- FAA Part 135 certificate designator when known
  website            text,
  email_domain       text,
  general_email      text,
  phone              text,
  hq_city            text,
  hq_state           text,
  hq_country         text default 'US',
  base_icaos         text[] not null default '{}',
  argus_rating       text,
  wyvern_rating      text,
  is_bao_stage       text,
  fleet_size         int,
  outreach_status    outreach_status not null default 'new',
  source             contact_source not null default 'manual',
  notes              text,
  profile_id         uuid references profiles(id) on delete set null,  -- if they sign up as Owner/Operator
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index operators_domain_idx on operators (email_domain) where email_domain is not null;
create unique index operators_certificate_idx on operators (certificate_number);
create index operators_status_idx on operators (outreach_status);
create index operators_bases_idx on operators using gin (base_icaos);
create trigger operators_updated before update on operators
  for each row execute function set_updated_at();

alter table registry_aircraft
  add constraint registry_aircraft_operator_fk foreign key (operator_id) references operators(id) on delete set null;

create table operator_contacts (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references operators(id) on delete cascade,
  full_name       text,
  role            text,                           -- charter sales, dispatch, DO, owner
  email           text not null,
  phone           text,
  source          contact_source not null default 'manual',
  verified_at     timestamptz,                    -- last bounce-free delivery or reply
  unsubscribed_at timestamptz,                    -- CAN-SPAM opt-out; never email after this is set
  bounced_at      timestamptz,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index operator_contacts_email_idx on operator_contacts (lower(email));
create index operator_contacts_operator_idx on operator_contacts (operator_id);
create trigger operator_contacts_updated before update on operator_contacts
  for each row execute function set_updated_at();

-- RLS: ops data. Service role bypasses RLS for imports; admins can read and edit.
alter table registry_aircraft enable row level security;
alter table aircraft_positions enable row level security;
alter table operators enable row level security;
alter table operator_contacts enable row level security;

create policy "admin reads registry" on registry_aircraft for select to authenticated using ((select is_admin()));
create policy "admin edits registry" on registry_aircraft for update to authenticated using ((select is_admin()));
create policy "admin reads positions" on aircraft_positions for select to authenticated using ((select is_admin()));
create policy "admin manages operators" on operators for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy "admin manages operator contacts" on operator_contacts for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- "Business aircraft on the ground within N nautical miles of an airport", the
-- query the sourcing engine runs when a trip request comes in.
create or replace function nearby_available_aircraft(p_icao text, p_radius_nm numeric default 50, p_max_age interval default '6 hours')
returns table (
  n_number text, icao_hex text, manufacturer text, model text, category aircraft_category, seats int,
  operator_id uuid, registrant_name text, nearest_icao text, distance_nm numeric, seen_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with origin as (select latitude, longitude from airports where icao = p_icao)
  select r.n_number, r.icao_hex, r.manufacturer, r.model, r.category, r.seats,
         r.operator_id, r.registrant_name, p.nearest_icao,
         round((3440.065 * acos(least(1.0, cos(radians(o.latitude)) * cos(radians(p.latitude))
           * cos(radians(p.longitude) - radians(o.longitude))
           + sin(radians(o.latitude)) * sin(radians(p.latitude)))))::numeric, 1) as distance_nm,
         p.seen_at
  from aircraft_positions p
  join registry_aircraft r on r.icao_hex = p.icao_hex
  cross join origin o
  where p.on_ground
    and p.seen_at > now() - p_max_age
    and 3440.065 * acos(least(1.0, cos(radians(o.latitude)) * cos(radians(p.latitude))
           * cos(radians(p.longitude) - radians(o.longitude))
           + sin(radians(o.latitude)) * sin(radians(p.latitude)))) <= p_radius_nm
  order by distance_nm;
$$;
revoke all on function nearby_available_aircraft(text, numeric, interval) from public;
grant execute on function nearby_available_aircraft(text, numeric, interval) to authenticated, service_role;
