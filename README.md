# Ba3be3i PVP — site

## 7wayej lazemhom personnalisation (fi `index.html`, cherche "REPLACE")

1. **`SERVER_JOIN_CODE`** — el join code mte3 serveur mte3ek 3al Cfx.re (el link `cfx.re/join/XXXXXX`). Bidounou, el status yban "Unavailable" (machi fake).
2. **Liens el streamers** (section Dashboard → Streamers) — kol `href="https://twitch.tv/REPLACE_..."` badlou bel link el 7a9i9i.
3. **`ba3be3i-pvp.fivem.link`** — el adresse el 7a9i9iya mte3 serveur (hero, dashboard, footer, CTA).
4. **`discord.gg/ba3be3ipvp`** — el invite link el 7a9i9i mte3 Discord.
5. **Prix el boutique** (`XX TND / mo`) — 7ott el as3ar eli te7eb.
6. **Gallery** — el cases "IMAGE COMING SOON" badelhom b vrai screenshots.

## El système ticket (chat 7ay + status + close) — kifeh ta3mlou ye5dem

Daba el tickets 7a9i9iyin: player ya3mel ticket, ya5ou code, ynajam ychat m3a el staff, ychouf status (Open/Claimed/Closed), w admin ynajam yreply/yclosi mel Admin panel. Kolha mbeniya 3la **Supabase** (database majjeni) + **Netlify Functions**.

### Étape 1 — Créer compte Supabase (majjeni, mel browser bark)
1. Emchi l [supabase.com](https://supabase.com) → **"Start your project"** → connecti b GitHub wala email.
2. **"New project"** → sammih (`ba3be3i-pvp`), 7ott database password (7afdhou f blasa, tal9a bih), 5tar region 9rib (Europe masalan).
3. Sta na 1-2 di9ay9 7atta el project yetsawwer.

### Étape 2 — Créer el tables
1. Fel project, sidebar → **"SQL Editor"** → **"New query"**.
2. Ftah el fichier `supabase-schema.sql` (fi hedha el package), copie kolha, paste fel éditeur.
3. Click **"Run"** (wala Ctrl+Enter).
4. Lezem tban "Success" — el tables `tickets` w `ticket_messages` etsawwrou.

### Étape 3 — Ya5ou el clés
1. Sidebar → **"Project Settings"** (gear icon) → **"API"**.
2. Copie:
   - **"Project URL"** (kif `https://xxxxx.supabase.co`)
   - **"service_role"** secret key (taht "Project API keys") — **Attention**: machi el "anon public" key, lazem el **service_role** (maktoub "secret" 7dhaha). Hedhi el key el amena, ma tnasharhach 7ata l7ad.

### Étape 4 — Env variables fi Netlify
Netlify → site mte3ek → **Site configuration → Environment variables → Add a variable**, zid kol wa7da (nafs khatawet `DISCORD_WEBHOOK_URL` eli 3malt 9bal):

| Key | Value |
|---|---|
| `SUPABASE_URL` | el "Project URL" (Étape 3) |
| `SUPABASE_SERVICE_KEY` | el "service_role" secret key (Étape 3) |
| `ADMIN_TOKEN_SECRET` | ay string tawil random (masalan 32 7arf/ra9m mixés — na3tik wa7ed: `bK9x!mQ7z2vP_r5Lw8Ndj4Fh1CtY6Ea3`, wala 5ale7 mennou wa7dek) |
| `ADMIN_ACCOUNTS_JSON` | `[{"user":"admin","pass":"changeme","name":"Admin"},{"user":"founder","pass":"changeme2","name":"Founder"}]` (badel el pass/users — chouf taht) |
| `DISCORD_WEBHOOK_URL` | (3andek dijà mel setup el 9dim — el Discord logs) |

Ba3d ma tzidhom kolhom → **Deploys → Trigger deploy → Deploy site**.

### Étape 5 — Testi
1. Ftah el site → **Support** → emla ticket → "Submit ticket".
2. Tal9a code (`ABC123XZ` masalan) — click **"View & chat"**.
3. Tal9a page chat, tenajam tzid message.
4. Ftah **Admin** (nav) → login → tal9a el ticket fel liste → click 3lih → reply → tal9aha tetla3 3end el player (refresh wala automatique kol 6 secondes).
5. Click **"Close ticket"** ki tekhlesou.

## Admin — kifeh tbadel el username/password

Machi fel `index.html` daba (t7awlet lel env var, akther secure — el credentials ma3adech visible fi "view source"). Badel el value mte3 **`ADMIN_ACCOUNTS_JSON`** fi Netlify (Étape 4 fou9):

```json
[
  { "user": "admin", "pass": "unpasswordkhas", "name": "Admin" },
  { "user": "modname", "pass": "passo5ra", "name": "ModName" }
]
```

Zid line 7asb kol wa7ed lezmou access. Save → **Trigger deploy** (env var jdida te7taj redeploy).

## Ticket form — attachments (image/video)

El attachment (screenshot/video) ye5dem via **Netlify Forms** (b jiha, machi Supabase — Supabase Storage machi mawjoud fi hedha el setup). Chouf **Site → Forms** fi Netlify bech tal9a el fichiers.

## Deploy 3al Netlify

Il site fih **Netlify Functions** (server-status, discord-log, w el 7 functions mte3 el ticket system). Deploy via **GitHub + Netlify** (kifma 3malna — badel fichier fi GitHub, Netlify ya3mel redeploy automatiquement) wala **Netlify CLI**. Drag & drop mel browser mumkin ma yeb3athech el functions.
