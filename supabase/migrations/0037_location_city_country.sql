-- Split city/country out from the single free-text address line so cards
-- can show "street address" and "city, country" as two distinct lines.
-- Populated going forward from reverse-geocoding when a location is added;
-- existing rows stay null until their owner re-saves the location.
alter table locations
  add column if not exists city text,
  add column if not exists country text;
