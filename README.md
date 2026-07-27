# 🎮 BGMI Esports Tournament Management Platform

A production-ready, full-stack esports web platform designed for BGMI tournament organizers, esports clubs, and gaming communities. It features automated slot reservation, mandatory UTR UPI payment verification, OCR scorecard reading, 1-click Discord credentials dispatching, and anti-cheat ban management.

---

## 🌐 Live Application Links

- 📊 **User Dashboard & Leaderboard:** [Open Live Dashboard](https://bgmi-tournament-platform.onrender.com/index.html)
- 📝 **Squad Registration & Slot Locker:** [Register Squad](https://bgmi-tournament-platform.onrender.com/register.html)
- 🎮 **Player Gaming Resume & Stats:** [Search Player Stats](https://bgmi-tournament-platform.onrender.com/profile.html)
- 🔑 **Organizer Admin Portal:** [Admin Login & Control Panel](https://bgmi-tournament-platform.onrender.com/admin.html)

---

## ✨ Key Features

### 👥 Player & User Features
- **Dynamic Tournament Info:** Auto-fetches active tournament title, mode (Solo/Duo/Squad), entry fee, and total prize pool.
- **Squad Registration:** Registers full 4-player squad + optional substitute (Player 5).
- **Anti-Fake Payment Protection:** Interactive UPI QR Code checkout with mandatory **12-Digit UTR Transaction ID** validation to prevent fake slot locks.
- **Instant Slot Locking:** Automatically reserves slot numbers (Slot #1, Slot #2, etc.) upon verification.
- **Player Stats Lookup:** Search lifetime BGMI UID records, tournament history, and win rates.

### 🛡️ Organizer & Admin Features
- **Secure JWT Authentication:** Dedicated Admin Sign-In & Registration system.
- **Tournament Creation:** Publish new tournaments with custom modes, deadlines, prize pools, and schedules.
- **1-Click Room Dispatcher:** Instantly broadcasts Custom Room ID & Password to Discord webhooks/channels.
- **Post-Match Screenshot OCR Reader:** End-game result screenshot scanning to auto-extract match points.
- **Anti-Cheat & Blacklist Manager:** Instant BGMI UID banning system with duplicate registration protection.

---

## 💻 Tech Stack

- **Frontend:** HTML5, Tailwind CSS, JavaScript (ES6+), Tesseract.js (Client OCR)
- **Backend:** Node.js, Express.js, JWT Authentication, Multer
- **Database:** MongoDB Atlas (Mongoose ORM)
- **Caching & Dispatching:** Redis, Discord Webhooks API
- **Deployment:** Render.com (Backend & Frontend) & GitHub CI/CD

---

## 🛠️ Local Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/harshtyagi2004/bgmi-tournament-platform.git](https://github.com/harshtyagi2004/bgmi-tournament-platform.git)
   cd bgmi-tournament-platform
