const axios = require('axios');

/**
 * Sends BGMI Room ID & Password to Discord
 * Supports Multi-Tenant Client Webhook URLs
 */
async function sendRoomCredentials(roomId, roomPassword, customWebhook) {
  // 1. Client ka Custom Discord Webhook prioritize karein
  // 2. Fallback to default DISCORD_WEBHOOK_URL from process.env
  const webhookUrl = customWebhook || process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("Discord Webhook URL is missing! Please provide a Webhook URL in Admin Panel.");
  }

  // Send Discord Embed Message
  await axios.post(webhookUrl, {
    embeds: [
      {
        title: "🎮 BGMI MATCH ROOM DETAILS",
        description: "Room Credentials generated! Join as per your allocated slot number.",
        color: 16738816, // Dark Orange Accent
        fields: [
          {
            name: "🔑 ROOM ID",
            value: `\`${roomId}\``,
            inline: true
          },
          {
            name: "🔐 PASSWORD",
            value: `\`${roomPassword}\``,
            inline: true
          }
        ],
        footer: {
          text: "Powered by BGMI Esports Tournament Platform"
        },
        timestamp: new Date().toISOString()
      }
    ]
  });
}

module.exports = { sendRoomCredentials };