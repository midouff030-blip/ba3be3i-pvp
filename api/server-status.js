// GET /api/server-status
// Queries the FiveM server's OWN dynamic.json endpoint directly
// (server-side, so the browser never deals with CORS or mixed-content
// issues). Doesn't depend on Cfx.re's public server list / join code —
// some servers aren't listed there even when they're online and joinable
// directly by IP, which is the case here.
//
// If the server's address/port ever changes, update SERVER_HOST /
// SERVER_PORT below and redeploy.

const { adapt } = require("../lib/http");

const SERVER_HOST = "ba3be3i.ddns.net";
const SERVER_PORT = "1026";

async function handler(event) {
  try {
    const upstream = await fetch(`http://${SERVER_HOST}:${SERVER_PORT}/dynamic.json`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!upstream.ok) {
      throw new Error(`Upstream responded ${upstream.status}`);
    }

    const data = await upstream.json();

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=15",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Server unreachable", detail: String(err) }),
    };
  }
}

module.exports = adapt(handler);
