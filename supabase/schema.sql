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

-- Enable RLS (rows visible to everyone for this public prototype)
alter table sessions      enable row level security;
alter table job_results   enable row level security;
alter table saved_jobs    enable row level security;
alter table chat_messages enable row level security;

create policy "public read/write sessions"      on sessions      for all using (true) with check (true);
create policy "public read/write job_results"   on job_results   for all using (true) with check (true);
create policy "public read/write saved_jobs"    on saved_jobs    for all using (true) with check (true);
create policy "public read/write chat_messages" on chat_messages for all using (true) with check (true);

-- Storage: 'cvs' bucket holds the raw uploaded CV files (path = <sessionId>/<fileName>).
-- Public so the app's getPublicUrl() "view CV" link works; anon can upload/read but NOT delete.
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', true)
  on conflict (id) do update set public = true;

create policy "cvs public insert" on storage.objects for insert to anon, authenticated with check (bucket_id = 'cvs');
create policy "cvs public select" on storage.objects for select to anon, authenticated using (bucket_id = 'cvs');
create policy "cvs public update" on storage.objects for update to anon, authenticated using (bucket_id = 'cvs') with check (bucket_id = 'cvs');
