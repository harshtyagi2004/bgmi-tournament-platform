const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connStr = process.env.MONGO_URI;

    if (!connStr) {
      console.error("❌ CRITICAL ERROR: MONGO_URI is missing in Environment Variables!");
      process.exit(1);
    }

    // Connect using environment variable only
    const conn = await mongoose.connect(connStr);
    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;