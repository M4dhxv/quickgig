-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/hwheqzshcrimhfmfbvca/sql

-- Sessions (one per CV upload / user visit)
create table if not exists sessions (
  id                     uuid primary key default gen_random_uuid(),
  file_name              text,
  search_term            text,
  profile                jsonb,        -- structured profile from parse-cv
  cv_path                text,         -- path in the 'cvs' storage bucket
  plan                   text default 'free',  -- 'free' | 'active'
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz default now()
);

-- Run these if the table already exists:
-- alter table sessions add column if not exists profile jsonb;
-- alter table sessions add column if not exists cv_path text;
-- alter table sessions add column if not exists plan text default 'free';
-- alter table sessions add column if not exists stripe_customer_id text;
-- alter table sessions add column if not exists stripe_subscription_id text;

-- Cached Adzuna job results per session
create table if not exists job_results (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references sessions(id) on delete cascade,
  adzuna_id     text not null,
  title         text not null,
  company       text,
  location      text,
  salary_min    integer,
  salary_max    integer,
  description   text,
  contract_time text,
  contract_type text,
  redirect_url  text,
  category      text,
  posted_at     timestamptz,
  score         integer,
  created_at    timestamptz default now()
);

-- Jobs the user saved / shortlisted
create table if not exists saved_jobs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id) on delete cascade,
  adzuna_id    text not null,
  title        text,
  company      text,
  location     text,
  salary_min   integer,
  salary_max   integer,
  redirect_url text,
  created_at   timestamptz default now(),
  unique (session_id, adzuna_id)
);

-- Sarah chat history
create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role       text check (role in ('user', 'sarah')) not null,
  content    text not null,
  created_at timestamptz default now()
);

-- ===== TRUE PER-USER ISOLATION =====
-- Every visitor gets a real auth identity (anonymous sign-in, role `authenticated`).
-- Each row is owned by user_id = auth.uid(); RLS only returns rows you own.
-- Requires: Auth → "Allow anonymous sign-ins" = ON.

alter table sessions      add column if not exists user_id uuid default auth.uid();
alter table job_results   add column if not exists user_id uuid default auth.uid();
alter table job_results   add column if not exists is_shared boolean default false;
alter table saved_jobs    add column if not exists user_id uuid default auth.uid();
alter table chat_messages add column if not exists user_id uuid default auth.uid();

alter table sessions      enable row level security;
alter table job_results   enable row level security;
alter table saved_jobs    enable row level security;
alter table chat_messages enable row level security;

-- sessions: owner-only for everything. plan/stripe_* are NOT user-writable
-- (only the Stripe edge functions, running as service_role, can set them).
create policy "sessions owner" on sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on sessions from anon, authenticated;
grant update (profile, file_name, cv_path, search_term) on sessions to authenticated;

-- chat_messages + saved_jobs: owner-only.
create policy "chat owner"  on chat_messages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved owner" on saved_jobs    for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- job_results: you write your own; rows flagged is_shared=true are world-readable
-- (that's how a shared /jobs/:id link works for other people).
create policy "jobres insert" on job_results for insert to authenticated with check (user_id = auth.uid());
create policy "jobres update" on job_results for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "jobres read shared or own" on job_results for select to anon, authenticated
  using (is_shared = true or user_id = auth.uid());

-- Storage: 'cvs' is PRIVATE and owner-scoped. Supabase stamps objects.owner =
-- auth.uid() on authenticated upload; you can only sign/read your own CV.
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false)
  on conflict (id) do update set public = false;

create policy "cvs owner" on storage.objects for all to authenticated
  using (bucket_id = 'cvs' and owner = auth.uid()) with check (bucket_id = 'cvs' and owner = auth.uid());

-- ===== WHATSAPP JOB ALERTS (scheduled) =====
-- Daily cron -> job-alerts edge function -> WhatsApp digest for PAID users.
alter table sessions add column if not exists last_alert_at timestamptz;

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule('gignearby-job-alerts', '0 14 * * *', $$
--   select net.http_post(
--     url := 'https://<ref>.supabase.co/functions/v1/job-alerts',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body := '{}'::jsonb)
-- $$);
-- job-alerts is deployed with --no-verify-jwt; it authenticates via the
-- x-cron-secret header (CRON_SECRET function secret). It sends only to paid
-- users with a verified phone + location whose last_alert_at is older than
-- MIN_HOURS, then stamps last_alert_at. Sends no-op until
-- TWILIO_WHATSAPP_ALERT_TEMPLATE_SID (an approved 4-var template) is set.
