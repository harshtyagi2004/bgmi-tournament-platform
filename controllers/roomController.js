const { sendRoomCredentials } = require('../services/discordBot');
const Tournament = require('../models/Tournament');

exports.broadcastRoom = async (req, res) => {
  try {
    const { roomId, roomPassword, customWebhook } = req.body;

    if (!roomId || !roomPassword) {
      return res.status(400).json({ 
        success: false, 
        error: "Room ID and Password are required!" 
      });
    }

    // Pass customWebhook along with Room ID and Password to the bot service
    await sendRoomCredentials(roomId, roomPassword, customWebhook);

    res.status(200).json({
      success: true,
      message: "Room credentials broadcasted successfully to Discord!"
    });
  } catch (err) {
    console.error("Broadcast Error:", err.message);
    res.status(500).json({ 
      success: false, 
      error: `Failed to broadcast: ${err.message}` 
    });
  }
};