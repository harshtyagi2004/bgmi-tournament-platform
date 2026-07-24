const redis = require('../config/redis');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');

exports.submitMatchScore = async (req, res) => {
  try {
    const { tournamentId, teamResults } = req.body;
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ success: false, error: 'Tournament not found' });

    const redisKey = `leaderboard:${tournamentId}`;

    for (const result of teamResults) {
      const killPts = (result.kills || 0) * (tournament.pointSystem.killPoints || 1);
      const placementPts = tournament.pointSystem.placementPoints.get(result.placement.toString()) || 0;
      const totalMatchPts = killPts + placementPts;

      await redis.zincrby(redisKey, totalMatchPts, result.teamId);
    }

    return res.status(200).json({ success: true, message: 'Live leaderboard updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getLiveLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const redisKey = `leaderboard:${tournamentId}`;

    const rawScores = await redis.zrevrange(redisKey, 0, -1, 'WITHSCORES');
    const leaderboard = [];

    for (let i = 0; i < rawScores.length; i += 2) {
      const teamId = rawScores[i];
      const score = parseInt(rawScores[i + 1], 10);
      const team = await Team.findById(teamId).select('teamName slotNumber');

      leaderboard.push({
        rank: (i / 2) + 1,
        teamName: team ? team.teamName : 'Unknown Squad',
        slotNumber: team ? team.slotNumber : 'N/A',
        totalPoints: score
      });
    }

    return res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};