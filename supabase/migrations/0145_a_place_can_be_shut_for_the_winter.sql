-- Temporarily closed: the pool is shut for renovation until March.
--
-- The map had two states, listed and not listed, and a kommun with a closed
-- pool had to choose between leaving people to drive to a locked door and
-- asking for the place to be taken off the map — after which nobody would find
-- it again when it reopened. This is the state in between, and it is the one a
-- partner can set without asking anyone: it is honest to a reader, it destroys
-- nothing, and undoing it is a click.
--
-- Two columns rather than one. The flag is the fact; the date is what a reader
-- actually wants to know and is often unknown when the sign goes up ("closed
-- until further notice"). Nothing is pinned in the guard trigger for these:
-- whoever may edit the place may say it is shut.
--
-- No cron clears them. A flag whose date has passed simply stops counting as
-- closed when it is read — see is_temporarily_closed below — so the worst a
-- forgotten flag does is nothing at all. A job that reopened places on a date
-- somebody typed in March would be worse: it would contradict the sign on the
-- door without anybody having looked.

alter table locations
  add column if not exists temporarily_closed boolean not null default false,
  add column if not exists closed_until date;

comment on column locations.temporarily_closed is
  'Shut for now, set by whoever looks after the place. Read through is_temporarily_closed(), which ignores a flag whose closed_until has passed.';
comment on column locations.closed_until is
  'When it is expected to open again, if anybody knows. Null means no date was given, not "forever".';

create or replace function public.is_temporarily_closed(
  p_closed boolean,
  p_until date
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_closed, false) and (p_until is null or p_until >= current_date);
$$;
