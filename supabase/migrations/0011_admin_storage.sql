-- Admins can view verification documents to review them.
create policy "admin reads verification files" on storage.objects for select to authenticated
  using (bucket_id = 'verification' and (select is_admin()));
