create table if not exists public.app_store (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);
alter table public.app_store enable row level security;
-- لا تضف أي policy للـanon. الـAPI يستخدم Service Role Key على Vercel فقط.
