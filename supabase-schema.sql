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
alter table tickets add column if not exists discord_id text; -- player's real Discord ID (optional, from the ticket form) — used to DM them when the ticket closes
alter table ticket_messages add column if not exists attachment_url text;
alter table ticket_messages add column if not exists attachment_type text;
alter table ticket_messages add column if not exists avatar_url text; -- admin's REAL Discord avatar (via Bot Token lookup), null for player messages

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

-- ============================================================
-- Update 2 — run this too: swap the old placeholder streamers for
-- the real Kick streamers. Live/offline + viewer count are now
-- detected AUTOMATICALLY from Kick's own API (see streamers-list.js
-- + KICK_CLIENT_ID/KICK_CLIENT_SECRET in Netlify env vars) — the
-- `live`/`viewers` values below are just a harmless starting point,
-- they get overwritten by the real status on every page load.
-- To rename a streamer or fix their URL later, just edit the row
-- here (SQL Editor or Table editor → streamers) — no code involved.
-- ============================================================
delete from streamers where id in ('ghost_tn','nova_tn','wolf_exe','raven77','kobra_tn','sniper404');

insert into streamers (id, name, platform, url, live, viewers, sort_order) values
  ('9baya701',     '9baya701',     'Kick', 'https://kick.com/9baya701',     false, null, 1),
  ('xsouzy',       'Xsouzy',       'Kick', 'https://kick.com/xsouzy',       false, null, 2),
  ('zgougou13',    'Zgougou13',    'Kick', 'https://kick.com/zgougou13',    false, null, 3),
  ('fusion10',     'Fusion10',     'Kick', 'https://kick.com/fusion10',     false, null, 4),
  ('tokbri',       'Tokbri',       'Kick', 'https://kick.com/tokbri',       false, null, 5),
  ('iheb10',       'Iheb10',       'Kick', 'https://kick.com/iheb10',       false, null, 6),
  ('rafa_lemridh', 'Rafa_lemridh', 'Kick', 'https://kick.com/rafa_lemridh', false, null, 7),
  ('itspiroli',    'Itspiroli',    'Kick', 'https://kick.com/itspiroli',    false, null, 8),
  ('deeva_tn',     'Deeva_tn',     'Kick', 'https://kick.com/deeva_tn',     false, null, 9),
  ('3amrouch11',   '3amrouch11',   'Kick', 'https://kick.com/3amrouch11',   false, null, 10)
on conflict (id) do update set
  name = excluded.name,
  platform = excluded.platform,
  url = excluded.url,
  sort_order = excluded.sort_order;
