// Shared helpers for the ticket system functions.
// Not a function itself — lives outside api/ so Vercel never treats it as
// its own route, just a plain importable module.

const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;         // e.g. https://xxxx.supabase.co
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;  // the SECRET service_role key
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET; // any long random string
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN; // "Bot" tab of the Discord app — used only to look up a user's real avatar/name by their Discord ID, never posts/joins anything
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET;
// Vercel sets VERCEL_URL automatically (no https://, and it's the per-deploy
// URL) — SITE_URL lets you override with your real domain; falls back to
// the auto one so links still work even if you forget to set it.
const SITE_URL = process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  };
}

// --- Supabase REST (PostgREST) helper ---------------------------------
async function sb(path, options) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options && options.headers),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null; // Supabase/PostgREST can return 200/201 with an empty body
  return JSON.parse(text);
}

// --- Short random ticket id --------------------------------------------
function genTicketId(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < (len || 8); i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// --- Admin accounts (server-side only — never sent to the browser) ----
// Set ADMIN_ACCOUNTS_JSON in Netlify env vars, e.g.:
// [{"user":"admin","pass":"changeme","name":"Admin"}]
function getAdminAccounts() {
  try {
    return JSON.parse(process.env.ADMIN_ACCOUNTS_JSON || "[]");
  } catch (err) {
    return [];
  }
}

// --- Signed admin session token (HMAC, no external deps) --------------
// `admin` is one entry from ADMIN_ACCOUNTS_JSON: { user, pass, name, discordId }.
// discordId travels inside the token so every later request (reply, close...)
// can re-resolve that admin's REAL Discord avatar/name via getDiscordUser()
// without needing to look ADMIN_ACCOUNTS_JSON up again.
function makeAdminToken(admin) {
  const payload = JSON.stringify({
    user: admin.user,
    name: admin.name,
    discordId: admin.discordId || null,
    exp: Date.now() + 8 * 60 * 60 * 1000, // 8h
  });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string" || !ADMIN_TOKEN_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(b64).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload; // { name, exp }
  } catch (err) {
    return null;
  }
}

// --- Supabase Storage upload (for chat attachments) --------------------
// Uploads a base64 file to the "ticket-attachments" bucket (must exist —
// see supabase-schema.sql) and returns its public URL. The bucket is
// public, so the URL works directly with no signing. Uses the service
// key, so this bypasses RLS entirely (safe: only our own functions call
// this, never the browser directly).
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024; // raw file size cap — Netlify Functions cap the whole request around 6MB, and base64 inflates size ~33%

async function uploadAttachment(ticketId, base64Data, contentType, fileName) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)");
  }
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment too large (max 3.5MB)");
  }
  const safeName = (fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${ticketId}/${Date.now()}-${safeName}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/ticket-attachments/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase Storage ${res.status}: ${text}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/ticket-attachments/${path}`;
}

// --- Discord real user lookup (bot token) — real avatar + real name ----
// Looks a Discord user up by their ID using a Bot Token (Discord Developer
// Portal -> your app -> Bot -> Reset Token). This is a lookup only: the
// bot never joins/posts anywhere, it just reads public profile info
// (username + avatar) for admins who've put their Discord ID in
// ADMIN_ACCOUNTS_JSON. Best-effort: if DISCORD_BOT_TOKEN isn't set, or the
// lookup fails, callers fall back to the plain name/colored-initials
// avatar — never breaks the actual feature (chat/login) over it.
const discordUserCache = new Map(); // discordId -> { data, expires }
const DISCORD_CACHE_MS = 10 * 60 * 1000; // 10 min — avoids hammering Discord's API on every reply

function defaultAvatarUrl(discordId) {
  try {
    const idx = Number((BigInt(discordId) >> 22n) % 6n); // Discord's own "no avatar set" formula
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch (err) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

async function getDiscordUser(discordId) {
  if (!discordId) return null;

  const cached = discordUserCache.get(discordId);
  if (cached && cached.expires > Date.now()) return cached.data;

  if (!DISCORD_BOT_TOKEN) return null; // not configured yet — caller falls back gracefully

  try {
    const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    const avatarUrl = u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
      : defaultAvatarUrl(u.id);
    const data = { id: u.id, name: u.global_name || u.username, avatarUrl };
    discordUserCache.set(discordId, { data, expires: Date.now() + DISCORD_CACHE_MS });
    return data;
  } catch (err) {
    return null;
  }
}

// --- Kick real live-status lookup (App Access Token, no per-streamer
// login needed) ----------------------------------------------------------
// Uses Kick's official Dev API (dev.kick.com) with the Client Credentials
// grant — a "server-to-server" app token that can read ANY channel's public
// live status without that streamer individually authorizing anything.
// Docs: https://github.com/KickEngineering/KickDevDocs
let kickAppToken = null; // { token, expires } — cached across warm invocations

async function getKickAppToken() {
  if (kickAppToken && kickAppToken.expires > Date.now()) return kickAppToken.token;
  if (!KICK_CLIENT_ID || !KICK_CLIENT_SECRET) return null; // not configured yet

  try {
    const res = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: KICK_CLIENT_ID,
        client_secret: KICK_CLIENT_SECRET,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    kickAppToken = {
      token: data.access_token,
      expires: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000, // refresh a minute early
    };
    return kickAppToken.token;
  } catch (err) {
    return null;
  }
}

// Pulls the channel slug out of a Kick URL, e.g.
// "https://kick.com/9baya701" -> "9baya701". The `streamers` table stores
// the full URL (as before); this just reuses it instead of a new column.
function kickSlugFromUrl(url) {
  try {
    const clean = String(url || "").trim().replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || null;
  } catch (err) {
    return null;
  }
}

const kickStatusCache = new Map(); // slug -> { data, expires }
const KICK_STATUS_CACHE_MS = 30 * 1000; // 30s — smooths out bursts of page loads

// Looks up live/viewer status for up to 50 Kick slugs in ONE request.
// Returns { [lowercaseSlug]: { isLive, viewers } }. Best-effort: returns {}
// (never throws) if KICK_CLIENT_ID/SECRET aren't set or the API call fails,
// so callers can fall back to whatever's already stored instead of breaking.
async function getKickChannelsStatus(slugs) {
  const wanted = Array.from(new Set((slugs || []).filter(Boolean).map((s) => s.toLowerCase())));
  if (!wanted.length) return {};

  const now = Date.now();
  const out = {};
  const toFetch = [];
  wanted.forEach((slug) => {
    const cached = kickStatusCache.get(slug);
    if (cached && cached.expires > now) out[slug] = cached.data;
    else toFetch.push(slug);
  });
  if (!toFetch.length) return out;

  const token = await getKickAppToken();
  if (!token) return out; // not configured — return whatever was cached (maybe nothing)

  try {
    const params = new URLSearchParams();
    toFetch.forEach((s) => params.append("slug", s));
    const res = await fetch(`https://api.kick.com/public/v1/channels?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return out;
    const body = await res.json();
    const rows = (body && body.data) || [];
    rows.forEach((c) => {
      if (!c || !c.slug) return;
      const slug = c.slug.toLowerCase();
      const data = {
        isLive: !!(c.stream && c.stream.is_live),
        viewers: c.stream && c.stream.is_live ? c.stream.viewer_count : null,
      };
      kickStatusCache.set(slug, { data, expires: now + KICK_STATUS_CACHE_MS });
      out[slug] = data;
    });
    return out;
  } catch (err) {
    return out;
  }
}

// --- Discord DM (bot token) — notifies a player when their ticket closes
// ------------------------------------------------------------------------
// Sends a direct message to a Discord user by their ID, using the same
// Bot Token as getDiscordUser(). IMPORTANT limitation (Discord anti-spam
// rule, not a bug here): a bot can only DM a user if they share at least
// one server with the bot — so the bot must actually be INVITED/added as a
// member of your Discord server (Developer Portal -> OAuth2 -> URL
// Generator -> check "bot" scope -> open the generated link -> add it to
// your server), not just have a token. Best-effort: never throws, returns
// true/false so callers can ignore failures (a closed ticket still closes
// even if the DM couldn't be sent).
async function sendDiscordDM(discordId, content) {
  if (!discordId || !DISCORD_BOT_TOKEN) return false;
  try {
    const chRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });
    if (!chRes.ok) return false;
    const channel = await chRes.json();

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    return msgRes.ok;
  } catch (err) {
    return false;
  }
}

// --- Discord webhook (best-effort, never throws) -----------------------
async function postDiscord(embed) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    // logging is best-effort — never break the actual feature over it
  }
}

module.exports = {
  json,
  sb,
  genTicketId,
  getAdminAccounts,
  makeAdminToken,
  verifyAdminToken,
  postDiscord,
  uploadAttachment,
  getDiscordUser,
  sendDiscordDM,
  getKickChannelsStatus,
  kickSlugFromUrl,
  SITE_URL,
};
