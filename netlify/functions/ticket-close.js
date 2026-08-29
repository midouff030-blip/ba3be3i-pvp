// POST { id, adminToken } -> { ok: true }
// Closes a ticket. Admin only.

const { json, sb, verifyAdminToken, postDiscord } = require("./lib/shared");

exports.handler = async function (event) {
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

  try {
    await sb(`tickets?id=eq.${encodeURIComponent(data.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "closed", updated_at: new Date().toISOString() }),
    });

    postDiscord({
      title: "🔒 Ticket closed",
      color: 0x63755c,
      fields: [
        { name: "Closed by", value: session.name, inline: true },
        { name: "Ticket", value: data.id, inline: true },
      ],
      timestamp: new Date().toISOString(),
    });

    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: "Could not close ticket", detail: String(err) });
  }
};
