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

-- ============================================================
-- Update — run this part too (safe to re-run, uses IF NOT EXISTS):
-- close reason, chat attachments (images/videos), and a
-- Supabase-backed streamers list the admin panel can toggle
-- live/offline without touching any code.
-- ============================================================

alter table tickets add column if not exists close_reason text;
alter table ticket_messages add column if not exists attachment_url text;
alter table ticket_messages add column if not exists attachment_type text;

-- Storage bucket for chat attachments (images/videos). Public bucket
-- so the stored URL works directly — uploads still only happen
-- server-side (Netlify Functions, service_role key), never from the
-- browser directly.
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

create table if not exists streamers (
  id text primary key,
  name text not null,
  platform text not null,       -- Twitch | Kick | YouTube
  url text not null,
  live boolean not null default false,
  viewers integer,
  sort_order integer not null default 0
);
alter table streamers enable row level security;

-- Seed with the same placeholder streamers already in index.html —
-- edit name/platform/url either here (SQL Editor → Table editor →
-- streamers) or straight from the Admin panel (live/offline only).
insert into streamers (id, name, platform, url, live, viewers, sort_order) values
  ('ghost_tn',  'Ghost_TN',  'Twitch',  'https://twitch.tv/REPLACE_GHOST_TN',      true,  342, 1),
  ('nova_tn',   'Nova_TN',   'Twitch',  'https://twitch.tv/REPLACE_NOVA_TN',       false, null, 2),
  ('wolf_exe',  'Wolf.exe',  'Kick',    'https://kick.com/REPLACE_WOLF_EXE',       true,  128, 3),
  ('raven77',   'Raven77',   'Twitch',  'https://twitch.tv/REPLACE_RAVEN77',       false, null, 4),
  ('kobra_tn',  'Kobra_TN',  'YouTube', 'https://youtube.com/@REPLACE_KOBRA_TN',   true,  210, 5),
  ('sniper404', 'Sniper404', 'Twitch',  'https://twitch.tv/REPLACE_SNIPER404',     false, null, 6)
on conflict (id) do nothing;
