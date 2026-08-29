// POST /api/ticket-close { id, adminToken, reason? } -> { ok: true }
// Closes a ticket. Admin only. The optional reason is stored on the
// ticket (close_reason column) and shown to the player + logged to
// Discord, so everyone can see why it was closed. If the player gave a
// valid Discord ID when opening the ticket, they also get DM'd.

const { adapt } = require("../lib/http");
const { json, sb, verifyAdminToken, postDiscord, getDiscordUser, sendDiscordDM, SITE_URL } = require("../lib/shared");

async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { error: "Invalid JSON" });
  }

  const session = verifyAdminToken(data.adminToken);
  if (!session) return json(401, { error: "Invalid or expired admin session" });
  if (!data.id) return json(400, { error: "Missing id" });

  const reason = (data.reason || "").slice(0, 500);

  try {
    // Fetched first (not just for the DM) so we know the player's
    // discord_id even though the PATCH below doesn't return the row.
    const tickets = await sb(`tickets?id=eq.${encodeURIComponent(data.id)}&limit=1`);
    if (!tickets || tickets.length === 0) return json(404, { error: "Ticket not found" });

    await sb(`tickets?id=eq.${encodeURIComponent(data.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "closed",
        close_reason: reason || null,
        updated_at: new Date().toISOString(),
      }),
    });

    const discordUser = await getDiscordUser(session.discordId);
    const closedByName = (discordUser && discordUser.name) || session.name;

    postDiscord({
      title: "🔒 Ticket closed",
      color: 0x63755c,
      fields: [
        { name: "Closed by", value: closedByName, inline: true },
        { name: "Ticket", value: data.id, inline: true },
        { name: "Reason", value: reason || "—" },
      ],
      timestamp: new Date().toISOString(),
    });

    // Best-effort DM to the player, only if they gave a valid Discord ID
    // when opening the ticket. Never blocks/fails the close itself — see
    // sendDiscordDM's own comment for why this can silently do nothing
    // (bot not added to a shared server, DMs closed, etc).
    if (tickets[0].discord_id) {
      const link = SITE_URL ? `${SITE_URL}/#ticket=${data.id}` : `#ticket=${data.id}`;
      const lines = [
        `🔒 **Ticket ${data.id} closed**`,
        `Reason: ${reason || "No reason given"}`,
        `View: ${link}`,
      ];
      await sendDiscordDM(tickets[0].discord_id, lines.join("\n"));
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: "Could not close ticket", detail: String(err) });
  }
}

module.exports = adapt(handler);
