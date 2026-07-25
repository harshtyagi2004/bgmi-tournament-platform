const axios = require('axios');

async function sendRoomCredentials(roomId, password) {
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const whatsappApiUrl = process.env.WHATSAPP_API_URL; // Optional WhatsApp API

  // 1. DISCORD EMBED BROADCAST LOGIC
  if (discordWebhookUrl) {
    try {
      await axios.post(discordWebhookUrl, {
        content: "🚨 **NEW BGMI MATCH ROOM DISPATCHED** 🚨",
        embeds: [
          {
            title: "🎮 Custom Room Credentials",
            color: 16738560, // Orange Theme
            fields: [
              { name: "🔑 Room ID", value: `\`${roomId}\``, inline: true },
              { name: "🔒 Password", value: `\`${password}\``, inline: true },
              { name: "⏱️ Instructions", value: "Join your allocated slot immediately! Do not share outside your team.", inline: false }
            ],
            footer: { text: "BGMI Tournament Platform Dispatcher Engine" },
            timestamp: new Date()
          }
        ]
      });
      console.log("✅ Successfully broadcasted credentials to Discord!");
    } catch (err) {
      console.error("❌ Discord Webhook Error:", err.message);
    }
  } else {
    console.log("ℹ️ Simulated Discord Broadcast -> Room ID:", roomId, "| Password:", password);
  }

  // 2. WHATSAPP API BROADCAST LOGIC (Optional API integration)
  if (whatsappApiUrl) {
    try {
      await axios.post(whatsappApiUrl, {
        message: `🎮 *BGMI MATCH ROOM ALERT*\n\n🔑 *Room ID:* ${roomId}\n🔒 *Password:* ${password}\n\nJoin quickly in your allocated slot!`
      });
      console.log("✅ Successfully sent WhatsApp notification!");
    } catch (err) {
      console.error("❌ WhatsApp Broadcast Error:", err.message);
    }
  }

  return true;
}

module.exports = { sendRoomCredentials };