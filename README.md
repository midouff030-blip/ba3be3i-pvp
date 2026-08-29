# Ba3be3i PVP — website (Vercel version)

Same features, same architecture (Supabase + Discord + Kick) as the
Netlify/Cloudflare versions — just hosted on Vercel. No CLI, no local
installs: GitHub's website + Vercel's dashboard only.

## Structure

- `index.html` — the whole site (single file).
- `api/*.js` — the backend, as Vercel serverless functions. Each file
  maps to a route: `api/ticket-create.js` -> `/api/ticket-create`.
- `lib/shared.js` — shared helpers (Supabase, Discord, Kick, admin
  sessions). Lives outside `api/` so Vercel doesn't treat it as its own
  route.
- `lib/http.js` — a small adapter so each function file can be written as
  a plain `async (event) => ({ statusCode, headers, body })`.
- `supabase-schema.sql` — unchanged, Supabase itself doesn't move.

## Deploy (GitHub + Vercel dashboard, no CLI)

1. Push this repo to GitHub (can replace the old Netlify/Cloudflare files
   in the same repo — `api/` + `lib/` are new, unrelated file names).
2. vercel.com -> sign up/log in -> **Add New...** -> **Project** -> Import
   the GitHub repo.
3. Framework Preset: **Other**. Build Command / Output Directory: leave
   as detected/empty — a plain `index.html` at the repo root is served
   automatically, no build step needed.
4. Before the first deploy (or right after, then redeploy), go to
   **Settings -> Environment Variables** and add, for Production:
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_TOKEN_SECRET`,
   `ADMIN_ACCOUNTS_JSON`, `DISCORD_WEBHOOK_URL`, `DISCORD_BOT_TOKEN`,
   `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`. `SITE_URL` is optional — Vercel
   already sets a working one automatically (`VERCEL_URL`), add `SITE_URL`
   only if you later attach a custom domain and want ticket links to use it.
5. Deploy. Every push to the connected branch redeploys automatically —
   no separate "trigger deploy" step needed, and no credits/pause system.

Supabase itself needs no changes — same project, same tables, same keys.
