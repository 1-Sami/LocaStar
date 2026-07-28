-- log_moderation_action() is SECURITY DEFINER and, like every function in this
-- schema, is exposed through PostgREST by default — so a signed-in user could
-- call /rest/v1/rpc/log_moderation_action and write arbitrary rows into the
-- audit log. An audit trail anyone can forge is worse than none, because it
-- looks authoritative.
--
-- Only the trigger functions need it, and those run as the definer, so revoke
-- it from the API roles entirely.
revoke execute on function log_moderation_action(text, text, uuid, jsonb) from public, anon, authenticated;

-- current_user_role() is harmless to read but there's no reason to expose it.
revoke execute on function current_user_role() from anon;
