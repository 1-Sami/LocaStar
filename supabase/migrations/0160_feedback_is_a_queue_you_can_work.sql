-- Feedback stops being a list you read and becomes a queue you can work:
-- mark it done, hand it to somebody, delete it.
--
-- Deleting already worked — 0120 gave admins a delete policy. The rest is new.
--
-- ## Who can see what, and the line 0120 drew
--
-- 0120 kept Superusers out of feedback deliberately: "A Superuser moderates
-- content; there is no moderation reason to read somebody's opinion about the
-- stat tiles." Assigning work to one means they have to be able to read it,
-- so that line moves — but only as far as it has to. A Superuser sees the
-- items assigned to them and nothing else. The queue as a whole stays admin-
-- only, which is what 0120 was actually protecting.
--
-- An assignee may mark their own item done. They may not hand it on, and they
-- may not take one that was given to somebody else: both halves of the policy
-- pin assigned_to to themselves, so an UPDATE that changes it fails the WITH
-- CHECK even though it passed the USING.
--
-- ## Still anonymous
--
-- Nothing here attaches a sender. feedback has no user_id and is not getting
-- one; assigned_to is the person who will *deal* with it, which is the
-- opposite end. The promise in 0120 and in the Privacy Policy — that a message
-- is saved without its author and cannot be replied to — is untouched.

alter table public.feedback
  add column if not exists done_at     timestamptz,
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

-- Partial: the overwhelming majority of rows are unassigned, and the only
-- query that uses this column looks for the ones that are not.
create index if not exists feedback_assigned_to_idx
  on public.feedback (assigned_to)
  where assigned_to is not null;

/*
 * Wrapped in (select ...), not called bare.
 *
 * A bare auth.uid() in a policy is re-evaluated once per row scanned; wrapping
 * it lets Postgres hoist it to an InitPlan and run it once for the statement.
 * The same mistake has been fixed across this schema before.
 */
create policy "assignees read their feedback"
  on public.feedback for select
  using (assigned_to = (select auth.uid()));

create policy "admins update feedback"
  on public.feedback for update
  using ((select is_admin()))
  with check ((select is_admin()));

create policy "assignees close their feedback"
  on public.feedback for update
  using (assigned_to = (select auth.uid()))
  with check (assigned_to = (select auth.uid()));
