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

// --- CONTROLLERS ---
const { submitMatchScore, getLiveLeaderboard } = require('./controllers/leaderboardController');
const { broadcastRoom } = require('./controllers/roomController');
const { processScoreScreenshot } = require('./controllers/ocrController');
const { createOrder, verifyPayment } = require('./controllers/paymentController');

// --- MONGOOSE MODELS ---
const Team = require('./models/Team');
const User = require('./models/User');
const Tournament = require('./models/Tournament');
const Blacklist = require('./models/Blacklist');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "bgmi_secret_admin_key_2026";

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json());

// ⚡ STRICT ANTI-CACHING HEADERS
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// ==========================================
// 🔐 ADMIN AUTHENTICATION APIs
// ==========================================

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
    const token = jwt.encode({ id: newAdmin._id, email: newAdmin.email, role: 'ADMIN' }, JWT_SECRET);

    res.status(200).json({
      success: true,
      token,
      admin: { id: newAdmin._id, name: newAdmin.name, email: newAdmin.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

    const token = jwt.encode({ id: admin._id, email: admin.email, role: 'ADMIN' }, JWT_SECRET);

    res.status(200).json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ success: false, error: "No session token" });

    const decoded = jwt.decode(token, JWT_SECRET);
    const admin = await User.findById(decoded.id);

    if (!admin || admin.role !== "ADMIN") {
      return res.status(401).json({ success: false, error: "Unauthorized access!" });
    }

    res.status(200).json({ success: true, admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch (err) {
    res.status(401).json({ success: false, error: "Invalid session token" });
  }
});

app.post('/api/admin/reset-tournaments', async (req, res) => {
  try {
    await Tournament.deleteMany({});
    await Team.deleteMany({});
    res.status(200).json({ success: true, message: "Database cleared successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🛡️ ANTI-CHEAT BLACKLIST APIs
// ==========================================

app.post('/api/admin/ban-player', async (req, res) => {
  try {
    const { bgmiUid, reason } = req.body;
    if (!bgmiUid) return res.status(400).json({ success: false, error: "BGMI UID is required!" });

    const bannedPlayer = await Blacklist.findOneAndUpdate(
      { bgmiUid },
      { bgmiUid, reason: reason || 'Hacking / Suspicious Gameplay' },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, message: `UID ${bgmiUid} successfully BANNED!`, bannedPlayer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/banned-players', async (req, res) => {
  try {
    const bannedList = await Blacklist.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, banned: bannedList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/unban-player', async (req, res) => {
  try {
    const { bgmiUid } = req.body;
    await Blacklist.deleteOne({ bgmiUid });
    res.status(200).json({ success: true, message: `UID ${bgmiUid} UNBANNED!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🚀 DYNAMIC TOURNAMENT APIs
// ==========================================

// 1. FETCH ACTIVE OR SPECIFIC TOURNAMENT BY ID (WITH ORGANIZER UPI ID)
app.get('/api/tournaments/get', async (req, res) => {
  try {
    const { tid } = req.query;
    let tournament = null;

    if (tid && mongoose.Types.ObjectId.isValid(tid)) {
      tournament = await Tournament.findById(tid);
    } else {
      tournament = await Tournament.findOne().sort({ createdAt: -1 });
    }

    if (!tournament) {
      return res.status(200).json({ success: true, tournament: null });
    }

    res.status(200).json({ 
      success: true, 
      tournamentId: tournament._id.toString(), 
      tournament 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. CREATE TOURNAMENT WITH CUSTOM ORGANIZER UPI ID
app.post('/api/tournaments/create', async (req, res) => {
  try {
    const { title, mode, entryFee, prizePool, maxSlots, upiId, registrationDeadline, schedule, token } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: "Tournament Title is required!" });
    }

    let organizerId = new mongoose.Types.ObjectId();
    if (token) {
      try {
        const decoded = jwt.decode(token, JWT_SECRET);
        organizerId = decoded.id;
      } catch (e) {}
    }

    const newTournament = new Tournament({
      title,
      mode: mode || "SQUAD",
      entryFee: Number(entryFee) || 0,
      prizePool: Number(prizePool) || 0,
      maxSlots: Number(maxSlots) || 25,
      upiId: upiId || 'esports@upi', // 💳 Save Organizer's custom UPI ID
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      schedule: schedule ? new Date(schedule) : null,
      status: "UPCOMING",
      organizerId
    });

    await newTournament.save();

    res.status(200).json({
      success: true,
      message: `Tournament "${title}" Created Successfully!`,
      tournament: newTournament
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. FETCH REGISTERED TEAMS
app.get('/api/tournaments/teams', async (req, res) => {
  try {
    const { tid } = req.query;
    let tournamentId = tid;

    if (!tournamentId || !mongoose.Types.ObjectId.isValid(tournamentId)) {
      const latest = await Tournament.findOne().sort({ createdAt: -1 });
      if (latest) tournamentId = latest._id;
    }

    if (!tournamentId) {
      return res.status(200).json({ success: true, teams: [] });
    }

    const teams = await Team.find({ tournamentId }).sort({ slotNumber: 1 });
    res.status(200).json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 👥 TEAM REGISTRATION & SLOT ALLOCATION
// ==========================================

app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamName, captainIgn, captainUid, members, transactionId, tournamentId } = req.body;

    let targetTid = tournamentId;
    if (!targetTid || !mongoose.Types.ObjectId.isValid(targetTid)) {
      const latest = await Tournament.findOne().sort({ createdAt: -1 });
      if (latest) targetTid = latest._id;
    }

    if (!targetTid) {
      return res.status(400).json({ success: false, error: "No active tournament found." });
    }

    if (!teamName || !captainIgn || !captainUid) {
      return res.status(400).json({ success: false, error: "Team Name and Captain details are required!" });
    }

    const allSquadUids = [captainUid, ...(members ? members.map(m => m.bgmiUid) : [])].filter(Boolean);

    // 1. Anti-Cheat Blacklist Check
    const isBanned = await Blacklist.findOne({ bgmiUid: { $in: allSquadUids } });
    if (isBanned) {
      return res.status(400).json({ 
        success: false, 
        error: `🚨 ANTI-CHEAT ALERT: BGMI UID (${isBanned.bgmiUid}) is BANNED! Reason: ${isBanned.reason}` 
      });
    }

    // 2. Duplicate Check
    const existingTeam = await Team.findOne({
      tournamentId: targetTid,
      $or: [
        { "captain.bgmiUid": { $in: allSquadUids } },
        { "members.bgmiUid": { $in: allSquadUids } }
      ]
    });

    if (existingTeam) {
      return res.status(400).json({ 
        success: false, 
        error: "One of the provided BGMI UIDs is already registered in this specific tournament!" 
      });
    }

    const count = await Team.countDocuments({ tournamentId: targetTid });
    const assignedSlot = count + 1;

    const squadMembers = [
      { ign: captainIgn, bgmiUid: captainUid },
      ...(members || [])
    ];

    const newTeam = new Team({
      tournamentId: targetTid,
      teamName,
      slotNumber: assignedSlot,
      captain: { ign: captainIgn, bgmiUid: captainUid },
      members: squadMembers,
      paymentStatus: 'PAID',
      transactionId: transactionId || 'FREE_ENTRY'
    });

    await newTeam.save();

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
      message: `Squad "${teamName}" Registered Successfully! Slot #${assignedSlot} Reserved.`, 
      team: newTeam 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 📷 OCR, DISPATCHER, PAYMENT & SCORES
// ==========================================

app.post('/api/tournaments/upload-score-ocr', upload.single('screenshot'), processScoreScreenshot);
app.post('/api/tournaments/broadcast-room', broadcastRoom);
app.post('/api/tournaments/score', submitMatchScore);
app.get('/api/tournaments/:tournamentId/leaderboard', getLiveLeaderboard);

app.post('/api/payments/create-order', createOrder);
app.post('/api/payments/verify', verifyPayment);

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
// 🛠️ SERVER INITIALIZATION
// ==========================================
const startServer = async () => {
  try {
    await connectDB();

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