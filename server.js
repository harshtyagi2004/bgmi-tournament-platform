require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jwt-simple');

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
const Tournament = require('./models/Tournament');
const Blacklist = require('./models/Blacklist'); // 🛡️ Anti-Cheat Model

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "bgmi_secret_admin_key_2026";

// --- ENSURE MULTER UPLOADS DIRECTORY EXISTS ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static frontend files from /public

let ACTIVE_TOURNAMENT_ID = null;

// ==========================================
// 🏠 ROOT REDIRECT ROUTE
// ==========================================
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// ==========================================
// 🔐 ADMIN AUTHENTICATION APIs
// ==========================================

// 1. ADMIN SIGN UP / REGISTER
app.post('/api/admin/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and Password are required!" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Admin account with this email already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new User({
      name: name || "Organizer Admin",
      email,
      password: hashedPassword,
      role: "ADMIN"
    });

    await newAdmin.save();
    const token = jwt.encode({ id: newAdmin._id, role: 'ADMIN' }, JWT_SECRET);

    res.status(200).json({
      success: true,
      message: "Admin account created successfully!",
      token,
      admin: { name: newAdmin.name, email: newAdmin.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. ADMIN SIGN IN / LOGIN
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, role: "ADMIN" });

    if (!admin) {
      return res.status(400).json({ success: false, error: "Invalid Admin Email or Password!" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Invalid Admin Email or Password!" });
    }

    const token = jwt.encode({ id: admin._id, role: 'ADMIN' }, JWT_SECRET);

    res.status(200).json({
      success: true,
      message: "Logged in successfully!",
      token,
      admin: { name: admin.name, email: admin.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🛡️ ANTI-CHEAT BLACKLIST & AI RADAR APIs
// ==========================================

// 3. ADMIN ANTI-CHEAT: BAN PLAYER UID
app.post('/api/admin/ban-player', async (req, res) => {
  try {
    const { bgmiUid, reason } = req.body;
    if (!bgmiUid) {
      return res.status(400).json({ success: false, error: "BGMI UID is required!" });
    }

    const bannedPlayer = await Blacklist.findOneAndUpdate(
      { bgmiUid },
      { bgmiUid, reason: reason || 'Hacking / Suspicious Gameplay' },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: `UID ${bgmiUid} BANNED from tournaments!`,
      bannedPlayer
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. FETCH ALL BANNED PLAYERS
app.get('/api/admin/banned-players', async (req, res) => {
  try {
    const bannedList = await Blacklist.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, banned: bannedList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. UNBAN PLAYER UID
app.post('/api/admin/unban-player', async (req, res) => {
  try {
    const { bgmiUid } = req.body;
    if (!bgmiUid) {
      return res.status(400).json({ success: false, error: "BGMI UID is required!" });
    }

    await Blacklist.deleteOne({ bgmiUid });
    res.status(200).json({ success: true, message: `UID ${bgmiUid} UNBANNED successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. REAL-TIME AI SPECTATOR ANOMALY DETECTOR
app.post('/api/admin/flag-suspicious', async (req, res) => {
  try {
    const { teamName, playerIgn, bgmiUid, kills, headshots } = req.body;

    let riskScore = 0;
    let reasons = [];

    // Rule 1: High Kills Check
    if (Number(kills) >= 12) {
      riskScore += 40;
      reasons.push(`Unusually High Kills (${kills} Kills)`);
    }

    // Rule 2: High Headshot Ratio Check
    if (Number(headshots) >= 8) {
      riskScore += 50;
      reasons.push(`Suspicious Headshot Accuracy (${headshots} Headshots)`);
    }

    const isSuspicious = riskScore >= 50;

    res.status(200).json({
      success: true,
      isSuspicious,
      riskScore: `${riskScore}%`,
      flag: isSuspicious ? "🚨 HIGH RISK (SUSPICIOUS)" : "🟢 NORMAL",
      playerDetails: { teamName, playerIgn, bgmiUid, kills, headshots },
      reasons
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🚀 TOURNAMENT & ORGANIZER APIs
// ==========================================

// 7. FETCH ACTIVE TOURNAMENT DETAILS
app.get('/api/tournaments/active', async (req, res) => {
  try {
    if (!ACTIVE_TOURNAMENT_ID) {
      return res.status(200).json({ success: true, tournament: null });
    }
    const tournament = await Tournament.findById(ACTIVE_TOURNAMENT_ID);
    res.status(200).json({ success: true, tournamentId: ACTIVE_TOURNAMENT_ID, tournament });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. CREATE & PUBLISH NEW TOURNAMENT
app.post('/api/tournaments/create', async (req, res) => {
  try {
    const { title, mode, entryFee, prizePool, maxSlots, registrationDeadline, schedule } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: "Tournament Title is required!" });
    }

    const newTournament = new Tournament({
      title,
      mode: mode || "SQUAD",
      entryFee: Number(entryFee) || 0,
      prizePool: Number(prizePool) || 0,
      maxSlots: Number(maxSlots) || 25,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      schedule: schedule ? new Date(schedule) : null,
      status: "UPCOMING",
      organizerId: new mongoose.Types.ObjectId()
    });

    await newTournament.save();
    ACTIVE_TOURNAMENT_ID = newTournament._id.toString();

    res.status(200).json({
      success: true,
      message: `Tournament "${title}" Created Successfully! Set as Active.`,
      tournament: newTournament
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. FETCH REGISTERED TEAMS WITH UTRs
app.get('/api/tournaments/teams', async (req, res) => {
  try {
    if (!ACTIVE_TOURNAMENT_ID) {
      return res.status(200).json({ success: true, teams: [] });
    }
    const teams = await Team.find({ tournamentId: ACTIVE_TOURNAMENT_ID }).sort({ slotNumber: 1 });
    res.status(200).json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 👥 TEAM REGISTRATION & SLOT ALLOCATION
// ==========================================

// 10. REGISTER TEAM / SQUAD (WITH ANTI-CHEAT & UTR)
app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamName, captainIgn, captainUid, members, transactionId } = req.body;
    const tournamentId = req.body.tournamentId || ACTIVE_TOURNAMENT_ID;

    if (!tournamentId) {
      return res.status(400).json({ success: false, error: "No active tournament found." });
    }

    if (!teamName || !captainIgn || !captainUid) {
      return res.status(400).json({ success: false, error: "Team Name and Captain details are required!" });
    }

    // Collect all squad UIDs
    const allSquadUids = [captainUid, ...(members ? members.map(m => m.bgmiUid) : [])].filter(Boolean);

    // 🛡️ ANTI-CHEAT CHECK: Blacklist Verification
    const isBanned = await Blacklist.findOne({ bgmiUid: { $in: allSquadUids } });
    if (isBanned) {
      return res.status(400).json({ 
        success: false, 
        error: `🚨 ANTI-CHEAT ALERT: UID (${isBanned.bgmiUid}) is BANNED due to: ${isBanned.reason}` 
      });
    }

    // ⚠️ DUPLICATE CHECK: Verify if UID is already registered
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

    // Assign Slot Number
    const count = await Team.countDocuments({ tournamentId });
    const assignedSlot = count + 1;

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
      paymentStatus: 'PAID',
      transactionId: transactionId || 'FREE_ENTRY'
    });

    await newTeam.save();

    // Create or Update User Stats
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
      message: `Squad "${teamName}" Registered Successfully! Slot #${assignedSlot} Locked.`, 
      team: newTeam 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 📷 OCR, DISPATCHER & LEADERBOARD APIs
// ==========================================

// 11. OCR SCREENSHOT SCANNER
app.post('/api/tournaments/upload-score-ocr', upload.single('screenshot'), processScoreScreenshot);

// 12. DISCORD & WHATSAPP DISPATCHER
app.post('/api/tournaments/broadcast-room', broadcastRoom);

// 13. MATCH SCORE ENTRY & LEADERBOARD
app.post('/api/tournaments/score', submitMatchScore);
app.get('/api/tournaments/:tournamentId/leaderboard', getLiveLeaderboard);

// 14. RAZORPAY UPI PAYMENT ENDPOINTS
app.post('/api/payments/create-order', createOrder);
app.post('/api/payments/verify', verifyPayment);

// 15. PLAYER GAMING PROFILE / STATS
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
    await connectDB();
    ACTIVE_TOURNAMENT_ID = await ensureActiveTournament();

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