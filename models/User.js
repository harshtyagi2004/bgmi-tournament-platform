const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Required for ADMIN
  bgmiUid: { type: String, sparse: true },
  ign: { type: String },
  role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
  stats: {
    tournamentsPlayed: { type: Number, default: 0 },
    totalKills: { type: Number, default: 0 },
    wins: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);