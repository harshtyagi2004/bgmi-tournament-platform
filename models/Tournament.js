const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  mode: { 
    type: String, 
    enum: ['SOLO', 'DUO', 'SQUAD'], 
    default: 'SQUAD' 
  },
  entryFee: { 
    type: Number, 
    default: 0 
  },
  prizePool: { 
    type: Number, 
    default: 0 
  },
  maxSlots: { 
    type: Number, 
    default: 25 
  },
  upiId: { 
    type: String, 
    default: 'esports@upi' // 💳 Organizer's Custom UPI ID
  },
  registrationDeadline: { 
    type: Date 
  },
  schedule: { 
    type: Date 
  },
  status: { 
    type: String, 
    enum: ['UPCOMING', 'LIVE', 'COMPLETED'], 
    default: 'UPCOMING' 
  },
  organizerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);