-- Personal data export requests (GDPR / App Store "request my data").
-- Users file a request from the app; admins fulfil it from the sourcing
-- queue. One open request per user at a time.

create table data_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  kind         text not null default 'export' check (kind in ('export')),
  status       text not null default 'pending'
               check (status in ('pending', 'fulfilled', 'rejected')),
  note         text,
  created_at   timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index data_requests_user_idx on data_requests (user_id, created_at desc);
create unique index data_requests_one_open_idx on data_requests (user_id)
  where status = 'pending';

alter table data_requests enable row level security;

create policy "own data requests" on data_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "file own data request" on data_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "admin manages data requests" on data_requests for all to authenticated
  using (is_admin());
