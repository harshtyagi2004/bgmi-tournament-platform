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

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "bgmi_secret_admin_key_2026";

// Multer Upload Setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let ACTIVE_TOURNAMENT_ID = null;

// Default Root Redirect
app.get('/', (req, res) => res.redirect('/index.html'));

// ==========================================
// 🔐 ADMIN AUTHENTICATION APIs (SIGN UP / SIGN IN)
// ==========================================

// 1. ADMIN SIGN UP
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

// 2. ADMIN SIGN IN
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
// 🚀 PUBLIC TOURNAMENT APIS
// ==========================================

app.get('/api/tournaments/active', async (req, res) => {
  try {
    if (!ACTIVE_TOURNAMENT_ID) return res.status(200).json({ success: true, tournament: null });
    const tournament = await Tournament.findById(ACTIVE_TOURNAMENT_ID);
    res.status(200).json({ success: true, tournamentId: ACTIVE_TOURNAMENT_ID, tournament });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/tournaments/teams', async (req, res) => {
  try {
    if (!ACTIVE_TOURNAMENT_ID) return res.status(200).json({ success: true, teams: [] });
    const teams = await Team.find({ tournamentId: ACTIVE_TOURNAMENT_ID }).sort({ slotNumber: 1 });
    res.status(200).json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ⚙️ PROTECTED ADMIN TOURNAMENT ACTIONS
// ==========================================

app.post('/api/tournaments/create', async (req, res) => {
  try {
    const { title, mode, entryFee, prizePool, maxSlots, registrationDeadline, schedule } = req.body;
    if (!title) return res.status(400).json({ success: false, error: "Title is required!" });

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

    res.status(200).json({ success: true, message: `Tournament "${title}" Created!`, tournament: newTournament });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Team Registration API
app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamName, captainIgn, captainUid, members } = req.body;
    const tournamentId = req.body.tournamentId || ACTIVE_TOURNAMENT_ID;

    if (!tournamentId) return res.status(400).json({ success: false, error: "No active tournament." });
    if (!teamName || !captainIgn || !captainUid) return res.status(400).json({ success: false, error: "Team & Captain details required!" });

    const allSquadUids = [captainUid, ...(members ? members.map(m => m.bgmiUid) : [])].filter(Boolean);
    const existingTeam = await Team.findOne({
      tournamentId,
      $or: [{ "captain.bgmiUid": { $in: allSquadUids } }, { "members.bgmiUid": { $in: allSquadUids } }]
    });

    if (existingTeam) return res.status(400).json({ success: false, error: "UID already registered in this tournament!" });

    const count = await Team.countDocuments({ tournamentId });
    const assignedSlot = count + 1;
    const squadMembers = [{ ign: captainIgn, bgmiUid: captainUid }, ...(members || [])];

    const newTeam = new Team({
      tournamentId,
      teamName,
      slotNumber: assignedSlot,
      captain: { ign: captainIgn, bgmiUid: captainUid },
      members: squadMembers,
      paymentStatus: 'PAID'
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

    res.status(200).json({ success: true, message: `Registered! Slot #${assignedSlot}`, team: newTeam });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dispatcher, OCR, Leaderboard, & Payments
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
    if (!player) return res.status(404).json({ success: false, error: "Player not found." });
    res.status(200).json({ success: true, player });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// START SERVER
const startServer = async () => {
  try {
    await connectDB();
    ACTIVE_TOURNAMENT_ID = await ensureActiveTournament();
    redis.connect().catch(() => {});

    const PORT = process.env.PORT || 5001;
    const listenWithFallback = (port) => {
      const server = app.listen(port, () => console.log(`🚀 Live on: http://localhost:${port}`));
      server.on('error', (err) => err.code === 'EADDRINUSE' ? listenWithFallback(port + 1) : console.error(err));
    };
    listenWithFallback(Number(PORT));
  } catch (err) {
    console.error("Server Start Error:", err.message);
  }
};

startServer();