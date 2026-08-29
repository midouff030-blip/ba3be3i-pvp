// POST /api/admin-login { user, pass } -> { token, name, avatarUrl } or 401
// Credentials are checked server-side against ADMIN_ACCOUNTS_JSON (an
// env var) — never shipped to the browser.

const { adapt } = require("../lib/http");
const { json, getAdminAccounts, makeAdminToken, postDiscord, getDiscordUser } = require("../lib/shared");

async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { error: "Invalid JSON" });
  }

  const accounts = getAdminAccounts();
  const match = accounts.find((a) => a.user === data.user && a.pass === data.pass);

  if (!match) return json(401, { error: "Wrong username or password" });

  // Real Discord name/avatar if this admin has a discordId set + the bot
  // token is configured — falls back to the plain ADMIN_ACCOUNTS_JSON name
  // (and colored-initials avatar client-side) otherwise.
  const discordUser = await getDiscordUser(match.discordId);
  const displayName = (discordUser && discordUser.name) || match.name;
  const avatarUrl = discordUser ? discordUser.avatarUrl : null;

  const token = makeAdminToken(match);

  postDiscord({
    title: "🔐 Admin logged in",
    color: 0x5865f2,
    description: displayName,
    timestamp: new Date().toISOString(),
  });

  return json(200, { token, name: displayName, avatarUrl });
}

module.exports = adapt(handler);
