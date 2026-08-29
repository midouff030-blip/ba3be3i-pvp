// POST /api/streamers-toggle { id, live, adminToken, viewers? } -> { ok: true }
// Flips a streamer's live/offline state (and optionally its viewer
// count) from the admin panel. Admin only. Kept as a manual fallback for
// non-Kick platforms — Kick streamers are detected automatically (see
// streamers-list.js) and the admin panel doesn't call this for them.

const { adapt } = require("../lib/http");
const { json, sb, verifyAdminToken } = require("../lib/shared");

async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { error: "Invalid JSON" });
  }

  const session = verifyAdminToken(data.adminToken);
  if (!session) return json(401, { error: "Invalid or expired admin session" });
  if (!data.id) return json(400, { error: "Missing id" });

  const patch = { live: !!data.live };
  if (typeof data.viewers === "number") patch.viewers = data.viewers;
  if (!patch.live) patch.viewers = null;

  try {
    await sb(`streamers?id=eq.${encodeURIComponent(data.id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: "Could not update streamer", detail: String(err) });
  }
}

module.exports = adapt(handler);
