-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Transactions table
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  merchant text not null,
  category text not null default 'Needs review',
  amount numeric not null,
  type text not null check (type in ('expense', 'income')),
  account text not null default '',
  bank text not null default '',
  tags text[] not null default '{}',
  receipt boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'csv', 'google-drive')),
  fingerprint text not null default '',
  created_at timestamptz not null default now()
);

-- Tags table
create table tags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Rules table
create table rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  when_text text not null,
  then_text text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Documents table
create table documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime_type text not null default '',
  size integer not null default 0,
  status text not null default 'queued' check (status in ('queued', 'stored', 'review')),
  source text not null default 'upload' check (source in ('upload', 'csv-import', 'google-drive')),
  created_at timestamptz not null default now()
);

-- Settings table (one row per user, stores JSON blob)
create table settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index idx_transactions_user on transactions(user_id);
create index idx_transactions_date on transactions(user_id, date);
create index idx_transactions_fingerprint on transactions(user_id, fingerprint);
create index idx_tags_user on tags(user_id);
create index idx_rules_user on rules(user_id);
create index idx_documents_user on documents(user_id);

-- Row Level Security (RLS) — users can only access their own data

alter table transactions enable row level security;
alter table tags enable row level security;
alter table rules enable row level security;
alter table documents enable row level security;
alter table settings enable row level security;

create policy "Users access own transactions" on transactions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own tags" on tags
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own rules" on rules
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own documents" on documents
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own settings" on settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
