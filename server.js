require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// --- DATABASE & CACHE CONFIGURATIONS ---
const connectDB = require('./config/db');
const redis = require('./config/redis');
const { ensureActiveTournament } = require('./services/dbService');

// --- CONTROLLERS ---
const { submitMatchScore, getLiveLeaderboard } = require('./controllers/leaderboardController');
const { broadcastRoom } = require('./controllers/roomController');
const { processScoreScreenshot } = require('./controllers/ocrController');
const { createOrder, verifyPayment } = require('./controllers/paymentController');

// --- MONGOOSE MODELS ---
const Team = require('./models/Team');
const User = require('./models/User');

const app = express();

// --- ENSURE MULTER UPLOADS DIRECTORY EXISTS ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files from /public directory

let ACTIVE_TOURNAMENT_ID = null;

// ==========================================
// 🚀 API ROUTES & ENDPOINTS
// ==========================================

// 1. ACTIVE TOURNAMENT ID HELPER
app.get('/api/tournaments/active', (req, res) => {
  res.status(200).json({ success: true, tournamentId: ACTIVE_TOURNAMENT_ID });
});

// 2. OCR SCREENSHOT UPLOAD & SCORE PARSING
app.post('/api/tournaments/upload-score-ocr', upload.single('screenshot'), processScoreScreenshot);

// 3. DISCORD & WHATSAPP ROOM DISPATCHER
app.post('/api/tournaments/broadcast-room', broadcastRoom);

// 4. LEADERBOARD & MATCH SCORE ENTRY
app.post('/api/tournaments/score', submitMatchScore);
app.get('/api/tournaments/:tournamentId/leaderboard', getLiveLeaderboard);

// 5. RAZORPAY PAYMENT & SLOT LOCKING
app.post('/api/payments/create-order', createOrder);
app.post('/api/payments/verify', verifyPayment);

// 6. FULL 4-PLAYER SQUAD REGISTRATION API
app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamName, captainIgn, captainUid, members } = req.body;
    const tournamentId = req.body.tournamentId || ACTIVE_TOURNAMENT_ID;

    if (!tournamentId) {
      return res.status(400).json({ success: false, error: "No active tournament found." });
    }

    if (!teamName || !captainIgn || !captainUid) {
      return res.status(400).json({ success: false, error: "Team Name and Captain details are required!" });
    }

    // Collect all UIDs provided across Captain + Members
    const allSquadUids = [captainUid, ...(members ? members.map(m => m.bgmiUid) : [])].filter(Boolean);

    // Duplicate Check: Verify if any provided UID is already registered
    const existingTeam = await Team.findOne({
      tournamentId,
      $or: [
        { "captain.bgmiUid": { $in: allSquadUids } },
        { "members.bgmiUid": { $in: allSquadUids } }
      ]
    });

    if (existingTeam) {
      return res.status(400).json({ 
        success: false, 
        error: "One of the provided BGMI UIDs is already registered in this tournament!" 
      });
    }

    // Calculate slot allocation
    const count = await Team.countDocuments({ tournamentId });
    const assignedSlot = count + 1;

    // Build Full Squad Array
    const squadMembers = [
      { ign: captainIgn, bgmiUid: captainUid },
      ...(members || [])
    ];

    const newTeam = new Team({
      tournamentId,
      teamName,
      slotNumber: assignedSlot,
      captain: { ign: captainIgn, bgmiUid: captainUid },
      members: squadMembers,
      paymentStatus: 'PAID'
    });

    await newTeam.save();

    // Create or Update Profile Stats for all squad members in MongoDB
    for (const player of squadMembers) {
      if (player.bgmiUid) {
        await User.findOneAndUpdate(
          { bgmiUid: player.bgmiUid },
          { 
            $setOnInsert: { name: player.ign, email: `${player.bgmiUid}@esports.com`, ign: player.ign },
            $inc: { "stats.tournamentsPlayed": 1 } 
          },
          { upsert: true, new: true }
        );
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Squad Registered Successfully! Slot #${assignedSlot} Locked.`, 
      team: newTeam 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. FETCH PLAYER GAMING RESUME PROFILE
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

// ==========================================
// 🛠️ SERVER INITIALIZATION & PORT FAILOVER
// ==========================================
const startServer = async () => {
  try {
    // Connect DB before taking requests
    await connectDB();
    ACTIVE_TOURNAMENT_ID = await ensureActiveTournament();

    // Optional Redis Caching
    redis.connect().catch(() => {
      console.warn("⚠️ Redis is offline. Running with fallback DB queries.");
    });

    const PORT = process.env.PORT || 5001;

    const listenWithFallback = (port) => {
      const server = app.listen(port, () => {
        console.log(`🚀 Platform live on: http://localhost:${port}`);
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