-- Additional profile fields surfaced in the Settings screen: a home address
-- and per-user notification toggles (theme_preference and avatar_url
-- already exist from 0001).

alter table profiles add column if not exists home_address text;
alter table profiles add column if not exists notification_preferences jsonb not null default '{"reviews": true, "shares": true, "marketing": false}'::jsonb;
