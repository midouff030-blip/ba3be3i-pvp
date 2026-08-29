// POST { id, body, sender: "player" | "admin", adminToken? } -> { ok: true }
// Player replies just need the ticket id (the link is their access).
// Admin replies must include a valid adminToken from admin-login.

const { json, sb, verifyAdminToken, postDiscord } = require("./lib/shared");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { error: "Invalid JSON" });
  }

  const id = data.id;
  const text = (data.body || "").slice(0, 4000);
  const sender = data.sender === "admin" ? "admin" : "player";

  if (!id || !text) return json(400, { error: "Missing id or body" });

  let senderName = "Player";

  if (sender === "admin") {
    const session = verifyAdminToken(data.adminToken);
    if (!session) return json(401, { error: "Invalid or expired admin session" });
    senderName = session.name;
  }

  try {
    const tickets = await sb(`tickets?id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!tickets || tickets.length === 0) return json(404, { error: "Ticket not found" });
    if (tickets[0].status === "closed") return json(409, { error: "Ticket is closed" });

    if (sender === "player") senderName = tickets[0].name || "Player";

    await sb("ticket_messages", {
      method: "POST",
      body: JSON.stringify({ ticket_id: id, sender, sender_name: senderName, body: text }),
    });

    // Claiming happens implicitly on an admin's first reply, if nobody has yet.
    if (sender === "admin" && !tickets[0].claimed_by) {
      await sb(`tickets?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "claimed", claimed_by: senderName, updated_at: new Date().toISOString() }),
      });
    } else {
      await sb(`tickets?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
    }

    if (sender === "admin") {
      postDiscord({
        title: "💬 Admin replied to a ticket",
        color: 0x5865f2,
        fields: [
          { name: "Admin", value: senderName, inline: true },
          { name: "Ticket", value: id, inline: true },
          { name: "Message", value: text.slice(0, 1000) },
        ],
        timestamp: new Date().toISOString(),
      });
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: "Could not post reply", detail: String(err) });
  }
};
