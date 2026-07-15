-- Give business claims a real effect: once an admin approves a claim, the
-- location gets marked verified and linked to its claimant. Also add the
-- missing delete policy so admins can permanently clear handled claims,
-- mirroring the location/review report moderation pattern.

alter table locations add column if not exists is_verified boolean not null default false;
alter table locations add column if not exists claimed_by uuid references profiles(id);

create policy "admins delete business claims" on business_claims
  for delete using (is_admin());
