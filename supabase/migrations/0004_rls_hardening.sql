-- RLS hardening pass (structural review before Phase 1).
--
-- Fixes three functional bugs:
--   1. user_roles had no INSERT policy for regular users, so onboarding could
--      not self-assign the owner/crew roles.
--   2. conversation_participants let any authenticated user join ANY
--      conversation by id (and then read its messages).
--   3. messages UPDATE let participants edit each other's message bodies; it
--      was only meant for marking messages read.
--
-- Plus best-practice cleanup:
--   - Wrap auth.uid()/helper calls in (select ...) so they evaluate once per
--     query instead of once per row (large speedup on big tables).
--   - Scope non-public policies to the authenticated role.
--   - Add missing indexes on FK/policy columns.
--   - Storage: allow owners to update/delete their own uploaded files.

-- ---------------------------------------------------------------------------
-- Helper functions: evaluate auth.uid() once inside
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function is_participant(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv and user_id = (select auth.uid())
  );
$$;

-- New: lets a conversation's creator bootstrap themselves as first participant
-- without opening self-joins to arbitrary conversations.
create or replace function conversation_has_participants(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants where conversation_id = conv
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy "profiles readable by all" on profiles;
drop policy "update own profile" on profiles;
drop policy "admin manages profiles" on profiles;

create policy "profiles readable by all" on profiles for select using (true);
create policy "update own profile" on profiles for update to authenticated
  using (id = (select auth.uid()));
create policy "admin manages profiles" on profiles for all to authenticated
  using ((select is_admin()));

-- ---------------------------------------------------------------------------
-- user_roles  (bug fix: users can self-assign non-privileged roles)
-- ---------------------------------------------------------------------------
drop policy "read own roles" on user_roles;
drop policy "admin manages roles" on user_roles;

create policy "read own roles" on user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy "self assign basic roles" on user_roles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role in ('traveler', 'owner', 'crew')
  );
create policy "admin manages roles" on user_roles for all to authenticated
  using ((select is_admin()));

-- ---------------------------------------------------------------------------
-- verification_documents
-- ---------------------------------------------------------------------------
drop policy "own or admin reads docs" on verification_documents;
drop policy "upload own docs" on verification_documents;
drop policy "admin updates docs" on verification_documents;

create policy "own or admin reads docs" on verification_documents for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy "upload own docs" on verification_documents for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "admin updates docs" on verification_documents for update to authenticated
  using ((select is_admin()));

-- ---------------------------------------------------------------------------
-- aircraft
-- ---------------------------------------------------------------------------
drop policy "active aircraft public" on aircraft;
drop policy "owner manages aircraft" on aircraft;

create policy "active aircraft public" on aircraft for select
  using (status = 'active' or owner_id = (select auth.uid()) or (select is_admin()));
create policy "owner manages aircraft" on aircraft for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- aircraft_photos
-- ---------------------------------------------------------------------------
drop policy "aircraft photos follow aircraft" on aircraft_photos;
drop policy "owner manages aircraft photos" on aircraft_photos;

create policy "aircraft photos follow aircraft" on aircraft_photos for select using (
  exists (select 1 from aircraft a where a.id = aircraft_id
          and (a.status = 'active' or a.owner_id = (select auth.uid()) or (select is_admin())))
);
create policy "owner manages aircraft photos" on aircraft_photos for all to authenticated using (
  exists (select 1 from aircraft a where a.id = aircraft_id and a.owner_id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- aircraft_availability
-- ---------------------------------------------------------------------------
drop policy "availability readable" on aircraft_availability;
drop policy "owner manages availability" on aircraft_availability;

create policy "availability readable" on aircraft_availability for select using (
  exists (select 1 from aircraft a where a.id = aircraft_id
          and (a.status = 'active' or a.owner_id = (select auth.uid()) or (select is_admin())))
);
create policy "owner manages availability" on aircraft_availability for all to authenticated using (
  exists (select 1 from aircraft a where a.id = aircraft_id and a.owner_id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- crew_profiles
-- ---------------------------------------------------------------------------
drop policy "active crew public" on crew_profiles;
drop policy "owner manages crew profile" on crew_profiles;

create policy "active crew public" on crew_profiles for select
  using (status = 'active' or user_id = (select auth.uid()) or (select is_admin()));
create policy "owner manages crew profile" on crew_profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- crew_availability
-- ---------------------------------------------------------------------------
drop policy "crew availability readable" on crew_availability;
drop policy "owner manages crew availability" on crew_availability;

create policy "crew availability readable" on crew_availability for select using (
  exists (select 1 from crew_profiles c where c.id = crew_profile_id
          and (c.status = 'active' or c.user_id = (select auth.uid()) or (select is_admin())))
);
create policy "owner manages crew availability" on crew_availability for all to authenticated using (
  exists (select 1 from crew_profiles c where c.id = crew_profile_id and c.user_id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- sale_listings
-- ---------------------------------------------------------------------------
drop policy "active sales public" on sale_listings;
drop policy "seller manages sales" on sale_listings;

create policy "active sales public" on sale_listings for select
  using (status = 'active' or seller_id = (select auth.uid()) or (select is_admin()));
create policy "seller manages sales" on sale_listings for all to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- sale_listing_photos
-- ---------------------------------------------------------------------------
drop policy "sale photos follow listing" on sale_listing_photos;
drop policy "seller manages sale photos" on sale_listing_photos;

create policy "sale photos follow listing" on sale_listing_photos for select using (
  exists (select 1 from sale_listings s where s.id = listing_id
          and (s.status = 'active' or s.seller_id = (select auth.uid()) or (select is_admin())))
);
create policy "seller manages sale photos" on sale_listing_photos for all to authenticated using (
  exists (select 1 from sale_listings s where s.id = listing_id and s.seller_id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- sale_inquiries
-- ---------------------------------------------------------------------------
drop policy "inquiry visible to seller or sender" on sale_inquiries;
drop policy "send inquiry" on sale_inquiries;

create policy "inquiry visible to seller or sender" on sale_inquiries for select to authenticated using (
  from_user = (select auth.uid())
  or exists (select 1 from sale_listings s where s.id = listing_id and s.seller_id = (select auth.uid()))
  or (select is_admin())
);
create policy "send inquiry" on sale_inquiries for insert to authenticated
  with check (from_user = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
drop policy "parties read booking" on bookings;
drop policy "buyer creates booking" on bookings;
drop policy "parties update booking" on bookings;

create policy "parties read booking" on bookings for select to authenticated
  using (buyer_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select is_admin()));
create policy "buyer creates booking" on bookings for insert to authenticated
  with check (buyer_id = (select auth.uid()));
create policy "parties update booking" on bookings for update to authenticated
  using (buyer_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select is_admin()));

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
drop policy "participant reads conversation" on conversations;
drop policy "authenticated creates conversation" on conversations;

create policy "participant reads conversation" on conversations for select to authenticated
  using ((select is_participant(id)) or (select is_admin()));
create policy "authenticated creates conversation" on conversations for insert to authenticated
  with check ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- conversation_participants  (bug fix: no self-joining arbitrary conversations)
-- ---------------------------------------------------------------------------
drop policy "see own participation" on conversation_participants;
drop policy "add self to conversation" on conversation_participants;

create policy "see own participation" on conversation_participants for select to authenticated
  using (user_id = (select auth.uid()) or is_participant(conversation_id) or (select is_admin()));
-- Creator bootstraps themselves into an empty conversation; after that, only
-- existing participants can add people.
create policy "join conversation" on conversation_participants for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and not conversation_has_participants(conversation_id))
    or is_participant(conversation_id)
  );

-- ---------------------------------------------------------------------------
-- messages  (bug fix: participants can only mark read, not edit bodies)
-- ---------------------------------------------------------------------------
drop policy "participant reads messages" on messages;
drop policy "participant sends message" on messages;
drop policy "mark own-conversation messages read" on messages;

create policy "participant reads messages" on messages for select to authenticated
  using (is_participant(conversation_id) or (select is_admin()));
create policy "participant sends message" on messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and is_participant(conversation_id));
create policy "mark messages read" on messages for update to authenticated
  using (is_participant(conversation_id));

-- Column-level guard: only read_at is updatable, so message bodies are immutable.
revoke update on table messages from anon, authenticated;
grant update (read_at) on table messages to authenticated;

-- ---------------------------------------------------------------------------
-- payments / payouts / stripe_accounts
-- ---------------------------------------------------------------------------
drop policy "parties read payment" on payments;
create policy "parties read payment" on payments for select to authenticated using (
  exists (select 1 from bookings b where b.id = booking_id
          and (b.buyer_id = (select auth.uid()) or b.provider_id = (select auth.uid())))
  or (select is_admin())
);

drop policy "provider reads payout" on payouts;
create policy "provider reads payout" on payouts for select to authenticated
  using (provider_id = (select auth.uid()) or (select is_admin()));

drop policy "own stripe account" on stripe_accounts;
create policy "own stripe account" on stripe_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
drop policy "reviews public" on reviews;
drop policy "reviewer writes review" on reviews;

create policy "reviews public" on reviews for select using (true);
create policy "reviewer writes review" on reviews for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1 from bookings b where b.id = booking_id
    and (b.buyer_id = (select auth.uid()) or b.provider_id = (select auth.uid()))
    and b.status = 'completed'
  )
);

-- ---------------------------------------------------------------------------
-- Missing FK / policy-column indexes
-- ---------------------------------------------------------------------------
create index if not exists aircraft_photos_aircraft_id_idx on aircraft_photos (aircraft_id);
create index if not exists sale_listing_photos_listing_id_idx on sale_listing_photos (listing_id);
create index if not exists sale_inquiries_listing_id_idx on sale_inquiries (listing_id);
create index if not exists sale_inquiries_from_user_idx on sale_inquiries (from_user);
create index if not exists verification_documents_user_id_idx on verification_documents (user_id);
create index if not exists conversations_booking_id_idx on conversations (booking_id);
create index if not exists conversation_participants_user_id_idx on conversation_participants (user_id);
create index if not exists messages_sender_id_idx on messages (sender_id);
create index if not exists payouts_booking_id_idx on payouts (booking_id);
create index if not exists bookings_aircraft_id_idx on bookings (aircraft_id);
create index if not exists bookings_crew_profile_id_idx on bookings (crew_profile_id);

-- ---------------------------------------------------------------------------
-- Storage: wrap auth.uid() and let owners update/delete their own files
-- ---------------------------------------------------------------------------
drop policy "user writes own avatar" on storage.objects;
drop policy "user writes own aircraft photos" on storage.objects;
drop policy "user writes own sale photos" on storage.objects;
drop policy "owner reads own verification" on storage.objects;
drop policy "owner uploads verification" on storage.objects;

create policy "user writes own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user updates own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user deletes own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user writes own aircraft photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'aircraft-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user updates own aircraft photos" on storage.objects for update to authenticated
  using (bucket_id = 'aircraft-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user deletes own aircraft photos" on storage.objects for delete to authenticated
  using (bucket_id = 'aircraft-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user writes own sale photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'sale-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user updates own sale photos" on storage.objects for update to authenticated
  using (bucket_id = 'sale-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user deletes own sale photos" on storage.objects for delete to authenticated
  using (bucket_id = 'sale-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owner reads own verification" on storage.objects for select to authenticated
  using (bucket_id = 'verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner uploads verification" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
