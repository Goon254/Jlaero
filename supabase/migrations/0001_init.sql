-- Jlaero core schema
-- Private-aviation marketplace: charter booking, crew booking, aircraft sales.
-- One account can act as traveler, owner, and/or crew (multi-role).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type account_type as enum ('individual', 'business');
create type app_role as enum ('traveler', 'owner', 'crew', 'admin');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');

create type aircraft_category as enum (
  'turboprop', 'very_light_jet', 'light_jet', 'midsize_jet',
  'super_midsize_jet', 'heavy_jet', 'ultra_long_range', 'airliner', 'helicopter'
);
create type listing_status as enum ('draft', 'active', 'paused', 'archived');

create type crew_kind as enum ('captain', 'first_officer', 'flight_attendant', 'engineer', 'other');

create type sale_status as enum ('draft', 'active', 'under_offer', 'sold', 'archived');

create type booking_kind as enum ('charter', 'crew');
create type booking_status as enum (
  'requested', 'quoted', 'negotiating', 'accepted',
  'paid', 'in_progress', 'completed', 'cancelled', 'declined', 'refunded'
);

create type payment_status as enum ('pending', 'authorized', 'captured', 'failed', 'refunded');
create type payout_status as enum ('pending', 'in_transit', 'paid', 'failed');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  avatar_url    text,
  phone         text,
  account_type  account_type not null default 'individual',
  company_name  text,
  bio           text,
  home_base     text,                       -- ICAO/IATA airport code
  verification  verification_status not null default 'unverified',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Multi-role membership
create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role    app_role not null,
  primary key (user_id, role)
);

-- Auto-create a profile + default 'traveler' role on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, role) values (new.id, 'traveler');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Convenience: is the current user an admin?
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Verification documents
-- ---------------------------------------------------------------------------
create table verification_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  doc_type    text not null,               -- 'id', 'operator_certificate', 'pilot_license', 'insurance', ...
  file_path   text not null,               -- storage path
  status      verification_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Aircraft (charter listings)
-- ---------------------------------------------------------------------------
create table aircraft (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,
  manufacturer  text,
  model         text,
  year          int,
  category      aircraft_category,
  seats         int,
  tail_number   text,
  home_base     text,
  description   text,
  hourly_rate   numeric(12,2),             -- charter rate per flight hour
  currency      text not null default 'USD',
  instant_book  boolean not null default false,
  status        listing_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on aircraft (owner_id);
create index on aircraft (status);
create trigger aircraft_updated before update on aircraft
  for each row execute function set_updated_at();

create table aircraft_photos (
  id          uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references aircraft(id) on delete cascade,
  file_path   text not null,
  position    int not null default 0
);

-- Availability / blocked ranges for an aircraft
create table aircraft_availability (
  id          uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references aircraft(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_blocked  boolean not null default false,   -- true = unavailable
  check (ends_at > starts_at)
);
create index on aircraft_availability (aircraft_id);

-- ---------------------------------------------------------------------------
-- Crew profiles (crew marketplace)
-- ---------------------------------------------------------------------------
create table crew_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  headline      text,
  crew_kind     crew_kind not null default 'captain',
  licenses      jsonb not null default '[]'::jsonb,   -- [{type, number, expires}]
  type_ratings  jsonb not null default '[]'::jsonb,
  total_hours   int,
  day_rate      numeric(12,2),
  currency      text not null default 'USD',
  home_base     text,
  bio           text,
  instant_book  boolean not null default false,
  status        listing_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on crew_profiles (user_id);
create index on crew_profiles (status);
create trigger crew_profiles_updated before update on crew_profiles
  for each row execute function set_updated_at();

create table crew_availability (
  id              uuid primary key default gen_random_uuid(),
  crew_profile_id uuid not null references crew_profiles(id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  is_blocked      boolean not null default false,
  check (ends_at > starts_at)
);
create index on crew_availability (crew_profile_id);

-- ---------------------------------------------------------------------------
-- Aircraft sales listings
-- ---------------------------------------------------------------------------
create table sale_listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references profiles(id) on delete cascade,
  aircraft_id   uuid references aircraft(id) on delete set null,
  title         text not null,
  manufacturer  text,
  model         text,
  year          int,
  price         numeric(14,2),
  currency      text not null default 'USD',
  location      text,
  description   text,
  status        sale_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on sale_listings (seller_id);
create index on sale_listings (status);
create trigger sale_listings_updated before update on sale_listings
  for each row execute function set_updated_at();

create table sale_listing_photos (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references sale_listings(id) on delete cascade,
  file_path  text not null,
  position   int not null default 0
);

create table sale_inquiries (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references sale_listings(id) on delete cascade,
  from_user  uuid not null references profiles(id) on delete cascade,
  message    text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings (charter or crew): the shared engine
-- ---------------------------------------------------------------------------
create table bookings (
  id               uuid primary key default gen_random_uuid(),
  kind             booking_kind not null,
  status           booking_status not null default 'requested',
  buyer_id         uuid not null references profiles(id) on delete cascade,
  provider_id      uuid not null references profiles(id) on delete cascade,
  aircraft_id      uuid references aircraft(id) on delete set null,
  crew_profile_id  uuid references crew_profiles(id) on delete set null,
  origin           text,                    -- airport code
  destination      text,
  depart_at        timestamptz,
  return_at        timestamptz,
  passengers       int,
  quoted_price     numeric(14,2),
  currency         text not null default 'USD',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (
    (kind = 'charter' and aircraft_id is not null) or
    (kind = 'crew' and crew_profile_id is not null)
  )
);
create index on bookings (buyer_id);
create index on bookings (provider_id);
create index on bookings (status);
create trigger bookings_updated before update on bookings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Messaging (real-time)
-- ---------------------------------------------------------------------------
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

create table conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

-- helper: is the current user a participant of a conversation?
create or replace function is_participant(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Payments & payouts (Stripe Connect)
-- ---------------------------------------------------------------------------
create table payments (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null references bookings(id) on delete cascade,
  stripe_payment_intent  text,
  amount                 numeric(14,2) not null,
  platform_fee           numeric(14,2) not null default 0,
  currency               text not null default 'USD',
  status                 payment_status not null default 'pending',
  created_at             timestamptz not null default now()
);
create index on payments (booking_id);

create table payouts (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid not null references profiles(id) on delete cascade,
  booking_id       uuid references bookings(id) on delete set null,
  stripe_transfer  text,
  amount           numeric(14,2) not null,
  currency         text not null default 'USD',
  status           payout_status not null default 'pending',
  created_at       timestamptz not null default now()
);
create index on payouts (provider_id);

-- Stripe Connect account per provider
create table stripe_accounts (
  user_id            uuid primary key references profiles(id) on delete cascade,
  stripe_account_id  text not null,
  charges_enabled    boolean not null default false,
  payouts_enabled    boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reviews (two-directional)
-- ---------------------------------------------------------------------------
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  reviewee_id uuid not null references profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (booking_id, reviewer_id)
);
create index on reviews (reviewee_id);
