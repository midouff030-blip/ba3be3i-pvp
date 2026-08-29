// GET (header x-admin-token) -> { tickets: [...] }
// Lists all tickets, newest first. Admin only.

const { json, sb, verifyAdminToken } = require("./lib/shared");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  const session = verifyAdminToken(token);
  if (!session) return json(401, { error: "Invalid or expired admin session" });

  try {
    const tickets = await sb("tickets?select=*&order=updated_at.desc&limit=200");
    return json(200, { tickets: tickets || [] });
  } catch (err) {
    return json(502, { error: "Could not list tickets", detail: String(err) });
  }
};
