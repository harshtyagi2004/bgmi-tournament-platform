const Tournament = require('../models/Tournament');
const mongoose = require('mongoose');

/**
 * Ensures a valid Tournament exists in MongoDB to attach registrations and scores to.
 */
async function ensureActiveTournament() {
  try {
    let tournament = await Tournament.findOne({ status: 'UPCOMING' });
    
    if (!tournament) {
      tournament = new Tournament({
        title: "BGMI India Championship 2026",
        mode: "SQUAD",
        entryFee: 50,
        prizePool: 10000,
        maxSlots: 25,
        status: "UPCOMING",
        // System / Default Organizer ID pass kar rahe hain validation pass karne ke liye
        organizerId: new mongoose.Types.ObjectId() 
      });
      
      await tournament.save();
      console.log(`✅ Default Active Tournament Created with ID: ${tournament._id}`);
    }
    
    return tournament._id.toString();
  } catch (err) {
    console.error("Database Seeding Error:", err.message);
    return null;
  }
}

module.exports = { ensureActiveTournament };