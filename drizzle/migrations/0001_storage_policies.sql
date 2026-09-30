-- Uploads go to course-media/<user_id>/... ; reads are served through signed URLs
create policy "users upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own media" on storage.objects for update to authenticated
  using (bucket_id = 'course-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'course-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own media" on storage.objects for select to authenticated
  using (bucket_id = 'course-media' and (storage.foldername(name))[1] = auth.uid()::text);
