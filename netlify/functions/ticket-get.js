const { adapt } = require("../lib/http");
const { json, sb } = require("../lib/shared");

async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return json(400, { error: "Missing ?id" });

  try {
    const tickets = await sb(`tickets?id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!tickets || tickets.length === 0) return json(404, { error: "Ticket not found" });

    const messages = await sb(`ticket_messages?ticket_id=eq.${encodeURIComponent(id)}&order=created_at.asc`);

    return json(200, { ticket: tickets[0], messages: messages || [] });
  } catch (err) {
    return json(502, { error: "Could not load ticket", detail: String(err) });
  }
}

module.exports = adapt(handler);
