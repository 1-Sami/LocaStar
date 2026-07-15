-- Security hardening: once a location is flagged/removed (e.g. reported as
-- hazardous), its reviews and photos must stop being publicly visible too,
-- not just the location record itself. Owners keep visibility into their
-- own content; admins always see everything.

drop policy "visible reviews are publicly readable" on reviews;
create policy "visible reviews are publicly readable" on reviews
  for select using (
    is_admin()
    or user_id = auth.uid()
    or (
      status = 'visible'
      and exists (
        select 1 from locations l
        where l.id = reviews.location_id and (l.status = 'active' or l.created_by = auth.uid())
      )
    )
  );

drop policy "location photos are publicly readable" on location_photos;
create policy "location photos are publicly readable" on location_photos
  for select using (
    is_admin()
    or exists (
      select 1 from locations l
      where l.id = location_photos.location_id and (l.status = 'active' or l.created_by = auth.uid())
    )
  );

drop policy "review photos are publicly readable" on review_photos;
create policy "review photos are publicly readable" on review_photos
  for select using (
    is_admin()
    or exists (
      select 1 from reviews r
      join locations l on l.id = r.location_id
      where r.id = review_photos.review_id
        and r.status = 'visible'
        and (l.status = 'active' or l.created_by = auth.uid() or r.user_id = auth.uid())
    )
  );
