const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mode: { type: String, enum: ['SOLO', 'DUO', 'SQUAD'], default: 'SQUAD' },
  entryFee: { type: Number, default: 0 },
  prizePool: { type: Number, required: true },
  maxSlots: { type: Number, default: 25 },
  roomDetails: {
    roomId: { type: String, default: '' },
    password: { type: String, default: '' },
    scheduledAt: { type: Date }
  },
  pointSystem: {
    killPoints: { type: Number, default: 1 },
    placementPoints: {
      type: Map,
      of: Number,
      default: { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 }
    }
  },
  registeredTeams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  status: { type: String, enum: ['UPCOMING', 'LIVE', 'COMPLETED'], default: 'UPCOMING' }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);