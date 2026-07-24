const Tournament = require('../models/Tournament');
const { announceRoomDetails } = require('../services/discordBot');

exports.broadcastRoom = async (req, res) => {
  try {
    const { tournamentId, roomId, password } = req.body;

    const tournament = await Tournament.findByIdAndUpdate(
      tournamentId,
      { 'roomDetails.roomId': roomId, 'roomDetails.password': password, status: 'LIVE' },
      { new: true }
    );

    if (!tournament) {
      return res.status(404).json({ success: false, error: 'Tournament record not found' });
    }

    const channelId = process.env.DISCORD_CHANNEL_ID || '1234567890';
    await announceRoomDetails(channelId, tournament.title, roomId, password);

    return res.status(200).json({
      success: true,
      message: 'Room credentials updated and dispatched to integration channels.',
      tournament
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};