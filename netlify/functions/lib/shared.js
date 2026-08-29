// Shared helpers for the ticket system functions.
// Not a function itself — Netlify only auto-publishes top-level files
// in netlify/functions/, so this nested lib/ file stays a plain module.

const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;         // e.g. https://xxxx.supabase.co
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;  // the SECRET service_role key
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET; // any long random string
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SITE_URL = process.env.URL || ""; // Netlify sets this automatically at runtime

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
  return res.json();
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
function makeAdminToken(name) {
  const payload = JSON.stringify({ name, exp: Date.now() + 8 * 60 * 60 * 1000 }); // 8h
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
  SITE_URL,
};
