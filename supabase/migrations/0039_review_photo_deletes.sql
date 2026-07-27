-- Review authors can already add photos to their own review, but there was no
-- delete policy — so removing a photo while editing a review silently did
-- nothing (RLS filtered the row out of the DELETE rather than erroring).
create policy "review authors delete review photos" on review_photos
  for delete using (
    is_admin()
    or exists (
      select 1 from reviews
      where reviews.id = review_photos.review_id
        and reviews.user_id = auth.uid()
    )
  );
