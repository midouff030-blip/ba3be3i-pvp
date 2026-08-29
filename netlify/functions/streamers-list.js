// GET -> { streamers: [...] }
// Public endpoint — the dashboard fetches this to show who's live.
// Live/offline + viewer count for Kick streamers is looked up for REAL from
// Kick's own API on every call (see lib/shared.js -> getKickChannelsStatus),
// using the slug at the end of each row's `url`. Name/platform/url/sort
// order still live in Supabase (edit those in Table editor as before); if
// the Kick lookup isn't configured yet or fails, this falls back to
// whatever's already stored for that row instead of showing it offline.

const { json, sb, getKickChannelsStatus, kickSlugFromUrl } = require("./lib/shared");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  try {
    const streamers = (await sb("streamers?select=*&order=sort_order.asc")) || [];

    const kickSlugs = streamers
      .filter((s) => (s.platform || "").toLowerCase() === "kick")
      .map((s) => kickSlugFromUrl(s.url))
      .filter(Boolean);

    const status = await getKickChannelsStatus(kickSlugs);

    const merged = streamers.map((s) => {
      if ((s.platform || "").toLowerCase() !== "kick") return s;
      const slug = kickSlugFromUrl(s.url);
      const live = slug && status[slug.toLowerCase()];
      if (!live) return s; // lookup not configured / failed — keep last known value
      return { ...s, live: live.isLive, viewers: live.isLive ? live.viewers : null };
    });

    return json(200, { streamers: merged });
  } catch (err) {
    return json(502, { error: "Could not load streamers", detail: String(err) });
  }
};
