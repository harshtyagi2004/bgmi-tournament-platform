const axios = require('axios');

async function sendRoomCredentials(roomId, password) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  const payload = {
    content: "🚨 **BGMI TOURNAMENT ROOM ALERT** 🚨",
    embeds: [
      {
        title: "🎮 Custom Room Credentials Dispatched",
        color: 16738560,
        fields: [
          { name: "Room ID", value: `\`${roomId}\``, inline: true },
          { name: "Password", value: `\`${password}\``, inline: true },
          { name: "Status", value: "JOIN IMMEDIATELY! ⌛", inline: false }
        ],
        footer: { text: "BGMI Tournament Platform Automation" }
      }
    ]
  };

  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, payload);
      console.log("✅ Dispatched credentials to Discord Webhook successfully!");
    } catch (err) {
      console.warn("⚠️ Discord Webhook trigger failed:", err.message);
    }
  } else {
    console.log("ℹ️ Simulated Discord Broadcast -> Room ID:", roomId, "| Password:", password);
  }
}

module.exports = { sendRoomCredentials };