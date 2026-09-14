-- StudyFlow: esquema multiusuario para Supabase
-- Ejecuta este archivo en Supabase > SQL Editor > New query.

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null,
  duration integer not null default 45 check (duration >= 0 and duration <= 720),
  date date not null,
  start_time time not null default '09:00',
  priority text not null default 'Media',
  status text not null default 'planificado',
  completed boolean not null default false,
  difficulty text not null default 'media',
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tests (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  date date not null,
  correct integer not null default 0 check (correct >= 0),
  incorrect integer not null default 0 check (incorrect >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null default 'General',
  task_id text,
  text text not null,
  date date not null,
  difficulty text not null default 'media',
  needs_review boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.tests enable row level security;
alter table public.notes enable row level security;

create policy "Users can manage their own tasks"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own tests"
  on public.tests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists tasks_user_date_idx on public.tasks(user_id, date);
create index if not exists tests_user_date_idx on public.tests(user_id, date);
create index if not exists notes_user_date_idx on public.notes(user_id, date);
