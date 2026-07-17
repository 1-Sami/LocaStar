-- Let a submitter choose whether they're shown as the creator of a location
-- they add (surfaced on the location detail page as "Added by @username").

alter table locations add column if not exists creator_visible boolean not null default true;
