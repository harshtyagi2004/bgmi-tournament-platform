const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  teamName: { type: String, required: true },
  slotNumber: { type: Number, required: true },
  captain: {
    ign: { type: String, required: true },
    bgmiUid: { type: String, required: true }
  },
  members: [{
    ign: { type: String },
    bgmiUid: { type: String }
  }],
  paymentStatus: { type: String, enum: ['PENDING', 'PAID'], default: 'PAID' },
  transactionId: { type: String, default: 'FREE' } // 12-Digit UTR / Transaction ID
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);