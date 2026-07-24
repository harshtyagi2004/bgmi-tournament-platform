const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  teamName: { type: String, required: true },
  slotNumber: { type: Number, required: true },
  captain: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ign: { type: String, required: true },
    bgmiUid: { type: String, required: true }
  },
  members: [{
    ign: { type: String, required: true },
    bgmiUid: { type: String, required: true }
  }],
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FREE'], default: 'FREE' },
  paymentTxnId: { type: String, default: '' }
}, { timestamps: true });

teamSchema.index({ tournamentId: 1, "captain.bgmiUid": 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);