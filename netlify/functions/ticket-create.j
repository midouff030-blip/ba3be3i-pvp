// POST { name, discord, category, message } -> { id }
// Creates a ticket + its first message, logs it to Discord.

const { json, sb, genTicketId, postDiscord, SITE_URL } = require("./lib/shared");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { error: "Invalid JSON" });
  }

  const name = (body.name || "").slice(0, 120);
  const discord = (body.discord || "").slice(0, 120);
  const category = (body.category || "Other").slice(0, 60);
  const message = (body.message || "").slice(0, 4000);

  if (!name || !message) return json(400, { error: "Missing name or message" });

  const id = genTicketId(8);

  try {
    await sb("tickets", {
      method: "POST",
      body: JSON.stringify({ id, name, discord, category, status: "open" }),
    });
    await sb("ticket_messages", {
      method: "POST",
      body: JSON.stringify({ ticket_id: id, sender: "player", sender_name: name, body: message }),
    });
  } catch (err) {
    return json(502, { error: "Could not create ticket", detail: String(err) });
  }

  const link = SITE_URL ? `${SITE_URL}/#ticket=${id}` : `#ticket=${id}`;
  postDiscord({
    title: "🎫 New ticket",
    color: 0x3cff6e,
    fields: [
      { name: "Reporter", value: name, inline: true },
      { name: "Discord", value: discord || "—", inline: true },
      { name: "Category", value: category, inline: true },
      { name: "Details", value: message.slice(0, 1000) },
      { name: "Ticket link", value: link },
    ],
    timestamp: new Date().toISOString(),
  });

  return json(200, { id });
};
