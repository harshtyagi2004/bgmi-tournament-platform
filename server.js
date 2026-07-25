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
app.use(express.static('public')); // Serve frontend static HTML files

let ACTIVE_TOURNAMENT_ID = null;

// --- API ROUTES ---

// 1. OCR Screenshot Upload Endpoint
app.post('/api/tournaments/upload-score-ocr', upload.single('screenshot'), processScoreScreenshot);

// 2. Active Tournament ID Helper Route
app.get('/api/tournaments/active', (req, res) => {
  res.status(200).json({ success: true, tournamentId: ACTIVE_TOURNAMENT_ID });
});

// 3. Dispatch Room Credentials
app.post('/api/tournaments/broadcast-room', broadcastRoom);

// 4. Submit Match Points & Get Live Leaderboard
app.post('/api/tournaments/score', submitMatchScore);
app.get('/api/tournaments/:tournamentId/leaderboard', getLiveLeaderboard);

// 5. Team Registration & Slot Auto-Assignment API
app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamName, captainIgn, captainUid } = req.body;
    const tournamentId = req.body.tournamentId || ACTIVE_TOURNAMENT_ID;

    if (!tournamentId) {
      return res.status(400).json({ success: false, error: "No active tournament found in system." });
    }

    // Check for Duplicate UID
    const existingTeam = await Team.findOne({ tournamentId, "captain.bgmiUid": captainUid });
    if (existingTeam) {
      return res.status(400).json({ success: false, error: "This BGMI UID is already registered in this tournament!" });
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

// 6. Fetch Real Player Gaming Resume API
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

// --- SERVER INITIALIZATION ---
const startServer = async () => {
  try {
    // Connect Database First
    await connectDB();
    ACTIVE_TOURNAMENT_ID = await ensureActiveTournament();

    // Connect Redis (Optional Caching)
    redis.connect().catch(() => {
      console.warn("⚠️ Redis is offline. Running with fallback DB queries.");
    });

    const PORT = process.env.PORT || 10000;
    
    const listenWithFallback = (port) => {
      const server = app.listen(port, () => {
        console.log(`🚀 Platform live on port: ${port}`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`⚠️ Port ${port} occupied, retrying on ${port + 1}...`);
          listenWithFallback(port + 1);
        } else {
          console.error("Server Error:", err.message);
        }
      });
    };

    listenWithFallback(Number(PORT));
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();