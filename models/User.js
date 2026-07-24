const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['PLAYER', 'ORGANIZER', 'ADMIN'], default: 'PLAYER' },
  bgmiUid: { type: String, default: '' },
  ign: { type: String, default: '' },
  stats: {
    tournamentsPlayed: { type: Number, default: 0 },
    totalKills: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);