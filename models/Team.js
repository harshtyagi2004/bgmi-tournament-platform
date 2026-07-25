const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  ign: { type: String, required: true },
  bgmiUid: { type: String, required: true }
});

const teamSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true },
  teamName: { type: String, required: true },
  slotNumber: { type: Number, required: true },
  captain: playerSchema,
  members: [playerSchema], // Stores Player 2, Player 3, Player 4
  paymentStatus: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', teamSchema);