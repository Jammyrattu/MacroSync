-- ---------------------------------------------------------------------------
-- Comments can carry a GIF.
--
-- A URL column rather than a bucket upload: GIFs come from the provider's CDN
-- and are hot-linked, so there is nothing of ours to store. Posts already work
-- this way via community_posts.image_url.
--
-- No policy changes needed — "comments insert own" and the staff delete policy
-- are row-level and already cover every column.
-- ---------------------------------------------------------------------------
alter table public.comments
  add column if not exists image_url text;

comment on column public.comments.image_url is
  'Optional GIF or image URL shown under the comment text.';
