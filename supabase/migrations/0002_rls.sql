-- Row-Level Security for Jlaero.
-- Principle: listings are publicly readable when active; everything a user owns
-- is theirs to manage; bookings/messages/payments are private to the parties;
-- admins can see/do everything.

alter table profiles                enable row level security;
alter table user_roles              enable row level security;
alter table verification_documents  enable row level security;
alter table aircraft                enable row level security;
alter table aircraft_photos         enable row level security;
alter table aircraft_availability   enable row level security;
alter table crew_profiles           enable row level security;
alter table crew_availability       enable row level security;
alter table sale_listings           enable row level security;
alter table sale_listing_photos     enable row level security;
alter table sale_inquiries          enable row level security;
alter table bookings                enable row level security;
alter table conversations           enable row level security;
alter table conversation_participants enable row level security;
alter table messages                enable row level security;
alter table payments                enable row level security;
alter table payouts                 enable row level security;
alter table stripe_accounts         enable row level security;
alter table reviews                 enable row level security;

-- ---- profiles ----
create policy "profiles readable by all" on profiles for select using (true);
create policy "update own profile" on profiles for update using (id = auth.uid());
create policy "admin manages profiles" on profiles for all using (is_admin());

-- ---- user_roles ----
create policy "read own roles" on user_roles for select using (user_id = auth.uid() or is_admin());
create policy "admin manages roles" on user_roles for all using (is_admin());

-- ---- verification_documents ----
create policy "own or admin reads docs" on verification_documents for select
  using (user_id = auth.uid() or is_admin());
create policy "upload own docs" on verification_documents for insert
  with check (user_id = auth.uid());
create policy "admin updates docs" on verification_documents for update using (is_admin());

-- ---- aircraft ----
create policy "active aircraft public" on aircraft for select
  using (status = 'active' or owner_id = auth.uid() or is_admin());
create policy "owner manages aircraft" on aircraft for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---- aircraft_photos ----
create policy "aircraft photos follow aircraft" on aircraft_photos for select using (
  exists (select 1 from aircraft a where a.id = aircraft_id
          and (a.status = 'active' or a.owner_id = auth.uid() or is_admin()))
);
create policy "owner manages aircraft photos" on aircraft_photos for all using (
  exists (select 1 from aircraft a where a.id = aircraft_id and a.owner_id = auth.uid())
);

-- ---- aircraft_availability ----
create policy "availability readable" on aircraft_availability for select using (
  exists (select 1 from aircraft a where a.id = aircraft_id
          and (a.status = 'active' or a.owner_id = auth.uid() or is_admin()))
);
create policy "owner manages availability" on aircraft_availability for all using (
  exists (select 1 from aircraft a where a.id = aircraft_id and a.owner_id = auth.uid())
);

-- ---- crew_profiles ----
create policy "active crew public" on crew_profiles for select
  using (status = 'active' or user_id = auth.uid() or is_admin());
create policy "owner manages crew profile" on crew_profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- crew_availability ----
create policy "crew availability readable" on crew_availability for select using (
  exists (select 1 from crew_profiles c where c.id = crew_profile_id
          and (c.status = 'active' or c.user_id = auth.uid() or is_admin()))
);
create policy "owner manages crew availability" on crew_availability for all using (
  exists (select 1 from crew_profiles c where c.id = crew_profile_id and c.user_id = auth.uid())
);

-- ---- sale_listings ----
create policy "active sales public" on sale_listings for select
  using (status = 'active' or seller_id = auth.uid() or is_admin());
create policy "seller manages sales" on sale_listings for all
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- ---- sale_listing_photos ----
create policy "sale photos follow listing" on sale_listing_photos for select using (
  exists (select 1 from sale_listings s where s.id = listing_id
          and (s.status = 'active' or s.seller_id = auth.uid() or is_admin()))
);
create policy "seller manages sale photos" on sale_listing_photos for all using (
  exists (select 1 from sale_listings s where s.id = listing_id and s.seller_id = auth.uid())
);

-- ---- sale_inquiries ----
create policy "inquiry visible to seller or sender" on sale_inquiries for select using (
  from_user = auth.uid()
  or exists (select 1 from sale_listings s where s.id = listing_id and s.seller_id = auth.uid())
  or is_admin()
);
create policy "send inquiry" on sale_inquiries for insert with check (from_user = auth.uid());

-- ---- bookings ----
create policy "parties read booking" on bookings for select
  using (buyer_id = auth.uid() or provider_id = auth.uid() or is_admin());
create policy "buyer creates booking" on bookings for insert
  with check (buyer_id = auth.uid());
create policy "parties update booking" on bookings for update
  using (buyer_id = auth.uid() or provider_id = auth.uid() or is_admin());

-- ---- conversations ----
create policy "participant reads conversation" on conversations for select
  using (is_participant(id) or is_admin());
create policy "authenticated creates conversation" on conversations for insert
  with check (auth.uid() is not null);

-- ---- conversation_participants ----
create policy "see own participation" on conversation_participants for select
  using (user_id = auth.uid() or is_participant(conversation_id) or is_admin());
create policy "add self to conversation" on conversation_participants for insert
  with check (user_id = auth.uid() or is_participant(conversation_id));

-- ---- messages ----
create policy "participant reads messages" on messages for select
  using (is_participant(conversation_id) or is_admin());
create policy "participant sends message" on messages for insert
  with check (sender_id = auth.uid() and is_participant(conversation_id));
create policy "mark own-conversation messages read" on messages for update
  using (is_participant(conversation_id));

-- ---- payments ----
create policy "parties read payment" on payments for select using (
  exists (select 1 from bookings b where b.id = booking_id
          and (b.buyer_id = auth.uid() or b.provider_id = auth.uid()))
  or is_admin()
);
-- writes happen server-side (service role bypasses RLS)

-- ---- payouts ----
create policy "provider reads payout" on payouts for select
  using (provider_id = auth.uid() or is_admin());

-- ---- stripe_accounts ----
create policy "own stripe account" on stripe_accounts for select
  using (user_id = auth.uid() or is_admin());

-- ---- reviews ----
create policy "reviews public" on reviews for select using (true);
create policy "reviewer writes review" on reviews for insert with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from bookings b where b.id = booking_id
    and (b.buyer_id = auth.uid() or b.provider_id = auth.uid())
    and b.status = 'completed'
  )
);
