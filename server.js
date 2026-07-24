require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const redis = require('./config/redis');
const { ensureActiveTournament } = require('./services/dbService');

const { submitMatchScore, getLiveLeaderboard } = require('./controllers/leaderboardController');
const { broadcastRoom } = require('./controllers/roomController');
const Team = require('./models/Team');
const User = require('./models/User');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { processScoreScreenshot } = require('./controllers/ocrController');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend HTML files
app.post('/api/tournaments/upload-score-ocr', upload.single('screenshot'), processScoreScreenshot);

let ACTIVE_TOURNAMENT_ID = null;

// Initialize Database Connections
connectDB().then(async () => {
  ACTIVE_TOURNAMENT_ID = await ensureActiveTournament();
});
redis.connect().catch(() => {});

// --- API ROUTES ---

// Active Tournament ID Helper Route
app.get('/api/tournaments/active', (req, res) => {
  res.status(200).json({ success: true, tournamentId: ACTIVE_TOURNAMENT_ID });
});

// 1. Dispatch Room Credentials
app.post('/api/tournaments/broadcast-room', broadcastRoom);

// 2. Submit Match Points & Get Live Leaderboard
app.post('/api/tournaments/score', submitMatchScore);
app.get('/api/tournaments/:tournamentId/leaderboard', getLiveLeaderboard);

// 3. Team Registration & Slot Auto-Assignment API (Persistent MongoDB)
app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamName, captainIgn, captainUid } = req.body;
    const tournamentId = req.body.tournamentId || ACTIVE_TOURNAMENT_ID;

    if (!tournamentId) {
      return res.status(400).json({ success: false, error: "No active tournament found." });
    }

    // Check for Duplicate UID
    const existingTeam = await Team.findOne({ tournamentId, "captain.bgmiUid": captainUid });
    if (existingTeam) {
      return res.status(400).json({ success: false, error: "This BGMI UID is already registered!" });
    }

    // Auto-calculate slot assignment
    const count = await Team.countDocuments({ tournamentId });
    const assignedSlot = count + 1;

    const newTeam = new Team({
      tournamentId,
      teamName,
      slotNumber: assignedSlot,
      captain: { ign: captainIgn, bgmiUid: captainUid },
      members: [{ ign: captainIgn, bgmiUid: captainUid }],
      paymentStatus: 'PAID'
    });

    await newTeam.save();

    // Create or Update User Profile stats in MongoDB
    await User.findOneAndUpdate(
      { bgmiUid: captainUid },
      { 
        $setOnInsert: { name: captainIgn, email: `${captainUid}@esports.com`, ign: captainIgn },
        $inc: { "stats.tournamentsPlayed": 1 } 
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ 
      success: true, 
      message: `Team Registered! Lock Slot #${assignedSlot}`, 
      team: newTeam 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Fetch Real Player Gaming Resume API
app.get('/api/players/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    let player = await User.findOne({ bgmiUid: uid });
    
    if (!player) {
      return res.status(404).json({ success: false, error: "Player profile not found." });
    }

    res.status(200).json({ success: true, player });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server with Fallback Port
const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`🚀 Platform live on: http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      startServer(port + 1);
    }
  });
};

const PORT = process.env.PORT || 5001;
startServer(Number(PORT));