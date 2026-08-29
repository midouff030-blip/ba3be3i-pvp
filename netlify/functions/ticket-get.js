// GET ?id=XXXXXXXX -> { ticket, messages }
// The ticket id itself is the "password" — anyone with the link can view
// and reply as the player. That's enough for this use case (players have
// no real accounts); don't reuse this pattern for anything more sensitive.

const { json, sb } = require("./lib/shared");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return json(400, { error: "Missing ?id" });

  try {
    const tickets = await sb(`tickets?id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!tickets || tickets.length === 0) return json(404, { error: "Ticket not found" });

    const messages = await sb(
      `ticket_messages?ticket_id=eq.${encodeURIComponent(id)}&order=created_at.asc`
    );

    return json(200, { ticket: tickets[0], messages: messages || [] });
  } catch (err) {
    return json(502, { error: "Could not load ticket", detail: String(err) });
  }
};
