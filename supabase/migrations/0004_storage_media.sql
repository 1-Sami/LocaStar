-- Public media bucket for location photos and profile avatars. Uploads are
-- namespaced by folder ("locations/<id>/..." / "avatars/<user_id>/...") but
-- write access is authenticated-only rather than per-folder-owner for MVP
-- simplicity — tighten later if abuse becomes a concern.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media is publicly readable" on storage.objects
  for select using (bucket_id = 'media');

create policy "authenticated users upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

create policy "users manage their own uploaded media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and owner = auth.uid())
  with check (bucket_id = 'media' and owner = auth.uid());

create policy "users delete their own uploaded media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and owner = auth.uid());
