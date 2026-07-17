-- Let users delete their own notifications (e.g. dismissing one from the list).

create policy "users delete own notifications" on notifications
  for delete using (auth.uid() = user_id);
