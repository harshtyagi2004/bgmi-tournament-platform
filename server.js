require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const connectDB = require('./config/db');
const redis = require('./config/redis');
const { ensureActiveTournament } = require('./services/dbService');

const { submitMatchScore, getLiveLeaderboard } = require('./controllers/leaderboardController');
const { broadcastRoom } = require('./controllers/roomController');
const { processScoreScreenshot } = require('./controllers/ocrController');
const { createOrder, verifyPayment } = require('./controllers/paymentController');

const Team = require('./models/Team');
const User = require('./models/User');

const app = express();

// Ensure uploads folder exists dynamically
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let ACTIVE_TOURNAMENT_ID = null;

// --- FEATURE 1: OCR SCREENSHOT API ---
app.post('/api/tournaments/upload-score-ocr', upload.single('screenshot'), processScoreScreenshot);

// --- FEATURE 2: RAZORPAY PAYMENT & SLOT LOCK APIs ---
app.post('/api/payments/create-order', createOrder);
app.post('/api/payments/verify', verifyPayment);

// --- FEATURE 3: DISCORD BROADCAST & CORE TOURNAMENT APIs ---
app.get('/api/tournaments/active', (req, res) => {
  res.status(200).json({ success: true, tournamentId: ACTIVE_TOURNAMENT_ID });
});

app.post('/api/tournaments/broadcast-room', broadcastRoom);
app.post('/api/tournaments/score', submitMatchScore);
app.get('/api/tournaments/:tournamentId/leaderboard', getLiveLeaderboard);

// Team Registration
app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamName, captainIgn, captainUid } = req.body;
    const tournamentId = req.body.tournamentId || ACTIVE_TOURNAMENT_ID;

    if (!tournamentId) {
      return res.status(400).json({ success: false, error: "No active tournament found." });
    }

    const existingTeam = await Team.findOne({ tournamentId, "captain.bgmiUid": captainUid });
    if (existingTeam) {
      return res.status(400).json({ success: false, error: "This BGMI UID is already registered!" });
    }

    const count = await Team.countDocuments({ tournamentId });
    const assignedSlot = count + 1;

    const newTeam = new Team({
      tournamentId,
      teamName,
      slotNumber: assignedSlot,
      captain: { ign: captainIgn, bgmiUid: captainUid },
      members: [{ ign: captainIgn, bgmiUid: captainUid }],
      paymentStatus: 'PENDING'
    });

    await newTeam.save();

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

// Player Resume Stats API
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

// --- SERVER STARTUP ---
const startServer = async () => {
  try {
    await connectDB();
    ACTIVE_TOURNAMENT_ID = await ensureActiveTournament();

    redis.connect().catch(() => {});

    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
      console.log(`🚀 Platform live on port: ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
  }
};

startServer();