const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
  bgmiUid: { type: String, required: true, unique: true },
  reason: { type: String, default: 'Hacking / Suspicious Gameplay' },
  bannedBy: { type: String, default: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('Blacklist', blacklistSchema);