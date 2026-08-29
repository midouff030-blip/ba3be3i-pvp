-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run.

create table if not exists tickets (
  id text primary key,
  name text,
  discord text,
  category text,
  status text not null default 'open',   -- open | claimed | closed
  claimed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id text not null references tickets(id) on delete cascade,
  sender text not null,        -- 'player' | 'admin'
  sender_name text,
  body text not null,
  created_at timestamptz not null default now()
);

-- Security: Row Level Security is ON with NO policies, so the public
-- anon key cannot read or write anything directly from a browser.
-- Every read/write goes through the Netlify Functions, which use the
-- SECRET service_role key (server-side only, never shipped to the
-- browser) to talk to this database.
alter table tickets enable row level security;
alter table ticket_messages enable row level security;
