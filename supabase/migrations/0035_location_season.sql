-- Let locations be tagged as available in summer, winter, both, or
-- neither (two independent flags rather than an enum, since a location
-- can be either, both, or neither). Existing rows default to neither —
-- they simply won't appear in season-filtered results until an owner
-- edits them.
alter table locations
  add column if not exists available_summer boolean not null default false,
  add column if not exists available_winter boolean not null default false;
