const { sendRoomCredentials } = require('../services/discordBot');
const Tournament = require('../models/Tournament');

exports.broadcastRoom = async (req, res) => {
  try {
    const { roomId, roomPassword } = req.body;

    if (!roomId || !roomPassword) {
      return res.status(400).json({ success: false, error: "Room ID and Password are required!" });
    }

    // Attempt to broadcast using discordBot service
    await sendRoomCredentials(roomId, roomPassword);

    res.status(200).json({
      success: true,
      message: "Room credentials broadcasted successfully to Discord & WhatsApp!"
    });
  } catch (err) {
    console.error("Broadcast Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};