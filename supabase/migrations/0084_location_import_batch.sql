-- Makes a bulk import reversible.
--
-- A git branch protects code; it does nothing for rows that have already
-- landed in the live database. What actually protects an import is being able
-- to undo exactly one batch without touching anything a real person added:
--
--   delete from locations where import_batch = 'osm-stockholm-library-2026-08-05';
--
-- Null for everything a human adds through the app, so the two never mix and
-- "delete the import" can never catch a real contribution.
--
-- Checked before adding, per the rule in CLAUDE.md: no SQL function has a
-- parameter called import_batch, so this cannot shadow one the way the lat/lng
-- columns silently broke nearby_locations in 0077.

alter table public.locations
  add column if not exists import_batch text;

comment on column public.locations.import_batch is
  'Identifies the bulk-import run that created this row, so one batch can be
   deleted cleanly. Null means a person added it through the app.';

-- Partial: the column is null for every human-added row, and those are the rows
-- there will eventually be most of.
create index if not exists locations_import_batch_idx
  on public.locations (import_batch)
  where import_batch is not null;
