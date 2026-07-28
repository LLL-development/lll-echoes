create table if not exists _screenshot_cache (
  key text primary key,
  data text not null,
  expires_at timestamptz not null
);
