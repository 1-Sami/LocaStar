-- The `media` bucket was created public with no size cap and no MIME
-- allowlist, and the INSERT policy is just `bucket_id = 'media'`. So any
-- signed-in account could put a file of any size and any type at any path,
-- and it would be served from the public storage URL.
--
-- Two things that actually matter before opening signups to the public:
--
-- 1. No size limit. One account uploading a few multi-gigabyte files runs up
--    storage and egress on the project with nothing to stop it. There is no
--    quota anywhere else in the stack — the RLS policy checks the bucket name
--    and nothing else.
--
-- 2. No MIME allowlist on a *public* bucket. An .html or .svg upload is served
--    back from the storage origin with its own content type, so the project
--    ends up hosting attacker-controlled markup and script under a
--    supabase.co URL. That is a different origin from locastar.se, so it does
--    not reach the app session, but it is a ready-made phishing host that
--    looks like it belongs to us.
--
-- Both are bucket attributes, so this needs no policy change and cannot lock
-- anyone out of what they have already uploaded.
--
-- Safe against the client: apps/mobile/src/lib/media-upload.ts is the only
-- upload call site in the codebase (verified by grep for `.upload(`) and it
-- always sends `contentType: 'image/jpeg'`. The allowlist below is wider than
-- that, so it has headroom if the picker is ever changed to pass the real
-- type through.
--
-- 15 MB rather than something tighter: expo-image-picker uploads at
-- quality 0.7, which lands well under that for a phone photo, but a high
-- megapixel camera can still produce several MB and refusing a genuine holiday
-- photo is worse than allowing a large one.

update storage.buckets
set
  file_size_limit = 15728640,  -- 15 MiB
  allowed_mime_types = array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
where id = 'media';
