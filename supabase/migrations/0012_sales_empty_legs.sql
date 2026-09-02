-- Phase 7: empty legs + inquiry conversations.

-- Empty legs: discounted repositioning flights at a fixed price.
create table empty_legs (
  id          uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references aircraft(id) on delete cascade,
  origin      text not null,
  destination text not null,
  depart_at   timestamptz not null,
  price       numeric(12,2) not null,
  currency    text not null default 'USD',
  seats       int,
  status      listing_status not null default 'active',
  created_at  timestamptz not null default now()
);
create index empty_legs_depart_at_idx on empty_legs (depart_at);
create index empty_legs_aircraft_id_idx on empty_legs (aircraft_id);

alter table empty_legs enable row level security;

create policy "active empty legs public" on empty_legs for select using (
  status = 'active'
  or exists (select 1 from aircraft a where a.id = aircraft_id and a.owner_id = (select auth.uid()))
  or (select is_admin())
);
create policy "owner manages empty legs" on empty_legs for all to authenticated using (
  exists (select 1 from aircraft a where a.id = aircraft_id and a.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from aircraft a where a.id = aircraft_id and a.owner_id = (select auth.uid()))
);

-- Non-booking conversations (sale inquiries): the creator could not read the
-- conversation back before becoming a participant. Track the creator.
alter table conversations add column created_by uuid references profiles(id) on delete set null;

create policy "creator reads own conversation" on conversations for select to authenticated
  using (created_by = (select auth.uid()));
