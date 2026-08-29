// Netlify Function: posts site/admin events to a Discord channel via an
// Incoming Webhook. Keeps the webhook URL secret (set as an env var in
// Netlify — never hardcode it in the front-end, or anyone could spam
// your channel).
//
// Setup:
//   1. In Discord: Server Settings -> Integrations -> Webhooks -> New
//      Webhook. Pick your #logs (or #tickets) channel, copy the URL.
//   2. In Netlify: Site settings -> Environment variables -> add
//      DISCORD_WEBHOOK_URL = <the URL you copied>.
//   3. Redeploy the site so the function picks up the env var.
//
// Called from the front-end as:
//   fetch('/.netlify/functions/discord-log', { method: 'POST', body: JSON.stringify({...}) })

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    // Not configured yet — fail quietly, the site still works without logging.
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "DISCORD_WEBHOOK_URL not set" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const embed = buildEmbed(payload);
  if (!embed) {
    return { statusCode: 400, body: "Unknown event type" };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) throw new Error("Discord responded " + res.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: "Failed to post to Discord", detail: String(err) }) };
  }
};

function buildEmbed(p) {
  const now = new Date().toISOString();

  switch (p.type) {
    case "new_ticket":
      return {
        title: "🎫 New ticket",
        color: 0x3cff6e,
        fields: [
          { name: "Reporter", value: p.name || "—", inline: true },
          { name: "Discord", value: p.discord || "—", inline: true },
          { name: "Category", value: p.category || "—", inline: true },
          { name: "Attachment", value: p.hasAttachment ? "Yes (see Netlify Forms)" : "None", inline: true },
          { name: "Details", value: (p.message || "—").slice(0, 1000) },
        ],
        timestamp: now,
      };
    case "ticket_claim":
      return {
        title: "✅ Ticket claimed",
        color: 0x3e9a45,
        fields: [
          { name: "Claimed by", value: p.admin || "Unknown admin", inline: true },
          { name: "Ticket", value: p.ticket || "—", inline: true },
          { name: "Reason / resolution", value: p.reason || "—" },
        ],
        timestamp: now,
      };
    case "admin_login":
      return {
        title: "🔐 Admin logged in",
        color: 0x5865f2,
        description: p.admin || "Unknown admin",
        timestamp: now,
      };
    case "admin_logout":
      return {
        title: "🔒 Admin logged out",
        color: 0x63755c,
        description: p.admin || "Unknown admin",
        timestamp: now,
      };
    default:
      return null;
  }
}
