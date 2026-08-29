const { adapt } = require("../lib/http");
const { json, sb, getKickChannelsStatus, kickSlugFromUrl } = require("../lib/shared");

async function handler(event) {
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
      if (!live) return s;
      return { ...s, live: live.isLive, viewers: live.isLive ? live.viewers : null };
    });

    return json(200, { streamers: merged });
  } catch (err) {
    return json(502, { error: "Could not load streamers", detail: String(err) });
  }
}

module.exports = adapt(handler);
