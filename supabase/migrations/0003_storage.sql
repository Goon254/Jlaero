-- Storage buckets and access policies.

insert into storage.buckets (id, name, public) values
  ('avatars',        'avatars',        true),
  ('aircraft-photos','aircraft-photos',true),
  ('sale-photos',    'sale-photos',    true),
  ('verification',   'verification',   false)
on conflict (id) do nothing;

-- Public buckets: anyone can read; owners write into a folder named by their uid.
create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "user writes own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public read aircraft photos" on storage.objects for select
  using (bucket_id = 'aircraft-photos');
create policy "user writes own aircraft photos" on storage.objects for insert
  with check (bucket_id = 'aircraft-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public read sale photos" on storage.objects for select
  using (bucket_id = 'sale-photos');
create policy "user writes own sale photos" on storage.objects for insert
  with check (bucket_id = 'sale-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verification docs: private. Owner and admin only.
create policy "owner reads own verification" on storage.objects for select
  using (bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner uploads verification" on storage.objects for insert
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text);
