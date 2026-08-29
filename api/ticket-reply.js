// POST /api/ticket-reply { id, body, sender: "player" | "admin", adminToken?,
//        attachmentBase64?, attachmentType?, attachmentName? } -> { ok: true }
// Player replies just need the ticket id (the link is their access).
// Admin replies must include a valid adminToken from admin-login.
// A message needs text OR an attachment (or both) — not neither.

const { adapt } = require("../lib/http");
const { json, sb, verifyAdminToken, postDiscord, uploadAttachment, getDiscordUser } = require("../lib/shared");

async function handler(event) {
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
  const hasAttachment = !!(data.attachmentBase64 && data.attachmentType);

  if (!id || (!text && !hasAttachment)) return json(400, { error: "Missing id, or an empty message with no attachment" });

  let senderName = "Player";
  let avatarUrl = null;

  if (sender === "admin") {
    const session = verifyAdminToken(data.adminToken);
    if (!session) return json(401, { error: "Invalid or expired admin session" });
    // Real Discord name/avatar (falls back to the ADMIN_ACCOUNTS_JSON name
    // + client-side colored-initials if no discordId / bot token set).
    const discordUser = await getDiscordUser(session.discordId);
    senderName = (discordUser && discordUser.name) || session.name;
    avatarUrl = discordUser ? discordUser.avatarUrl : null;
  }

  try {
    const tickets = await sb(`tickets?id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!tickets || tickets.length === 0) return json(404, { error: "Ticket not found" });
    if (tickets[0].status === "closed") return json(409, { error: "Ticket is closed" });

    if (sender === "player") senderName = tickets[0].name || "Player";

    let attachmentUrl = null;
    if (hasAttachment) {
      try {
        attachmentUrl = await uploadAttachment(id, data.attachmentBase64, data.attachmentType, data.attachmentName);
      } catch (err) {
        return json(502, { error: "Could not upload attachment", detail: String(err) });
      }
    }

    await sb("ticket_messages", {
      method: "POST",
      body: JSON.stringify({
        ticket_id: id,
        sender,
        sender_name: senderName,
        body: text,
        attachment_url: attachmentUrl,
        attachment_type: hasAttachment ? data.attachmentType : null,
        avatar_url: avatarUrl,
      }),
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
          { name: "Message", value: text ? text.slice(0, 1000) : (attachmentUrl ? "(attachment)" : "—") },
        ],
        timestamp: new Date().toISOString(),
      });
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: "Could not post reply", detail: String(err) });
  }
}

module.exports = adapt(handler);
