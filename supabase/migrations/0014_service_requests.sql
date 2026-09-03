-- Services vertical: FBO services, hangars, aircraft detailing, etc.
-- Request-first (not a listing): traveler/operator files a request, ops
-- sources and responds. Simple standalone table; graduates to the booking
-- engine if service fulfillment later needs quotes/payments in-app.

create type service_category as enum (
  'hangar', 'detailing', 'fbo_services', 'maintenance', 'catering', 'ground_transport', 'other'
);
create type service_request_status as enum ('open', 'in_progress', 'fulfilled', 'closed');

create table service_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  category    service_category not null,
  airport     text,
  needed_from date,
  needed_to   date,
  details     text not null,
  status      service_request_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index service_requests_status_idx on service_requests (status);
create index service_requests_user_id_idx on service_requests (user_id);

alter table service_requests enable row level security;

create policy "own service requests" on service_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy "file service request" on service_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "admin manages service requests" on service_requests for update to authenticated
  using ((select is_admin()));
