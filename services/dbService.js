const Tournament = require('../models/Tournament');

/**
 * Ensures clean database startup without creating dummy/fake tournaments.
 */
async function ensureActiveTournament() {
  try {
    const existing = await Tournament.findOne().sort({ createdAt: -1 });
    if (existing) {
      console.log(`🟢 Active Tournament Found: "${existing.title}" (ID: ${existing._id})`);
      return existing._id.toString();
    } else {
      console.log("ℹ️ No active tournament in database. Waiting for Admin to create one.");
      return null;
    }
  } catch (err) {
    console.error("Database Check Error:", err.message);
    return null;
  }
}

module.exports = { ensureActiveTournament };