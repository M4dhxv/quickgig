-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/hwheqzshcrimhfmfbvca/sql

-- Sessions (one per CV upload / user visit)
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  file_name   text,
  search_term text,
  created_at  timestamptz default now()
);

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
