// POST { user, pass } -> { token, name } or 401
// Credentials are checked server-side against ADMIN_ACCOUNTS_JSON (an
// env var) — never shipped to the browser, unlike the old client-side
// check. This is a real (if simple) login now.

const { json, getAdminAccounts, makeAdminToken, postDiscord } = require("./lib/shared");

exports.handler = async function (event) {
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

  const token = makeAdminToken(match.name);

  postDiscord({
    title: "🔐 Admin logged in",
    color: 0x5865f2,
    description: match.name,
    timestamp: new Date().toISOString(),
  });

  return json(200, { token, name: match.name });
};
