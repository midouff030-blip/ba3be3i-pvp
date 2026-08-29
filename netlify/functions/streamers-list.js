// GET -> { streamers: [...] }
// Public endpoint — the dashboard fetches this to show who's live.
// Live/offline is toggled by hand from the admin panel (streamers-toggle.js);
// see supabase-schema.sql for the seed data and how to edit names/links.

const { json, sb } = require("./lib/shared");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  try {
    const streamers = await sb("streamers?select=*&order=sort_order.asc");
    return json(200, { streamers: streamers || [] });
  } catch (err) {
    return json(502, { error: "Could not load streamers", detail: String(err) });
  }
};
