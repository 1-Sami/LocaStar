-- A fourth thing a location can be: over.
--
-- Alone in its own migration because Postgres will not let a new enum value be
-- *used* in the same transaction that adds it. Everything that reads or writes
-- 'past' is in 0109.
--
-- Deliberately not reusing 'removed'. That now means "a moderator took this
-- down" and feeds the thirty-day purge; an activity reaching its end date is
-- not a takedown and must never be mistaken for one in the moderation log.

alter type public.location_status add value if not exists 'past';
