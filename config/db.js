const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Strictly use environment variable
    const uri = process.env.MONGO_URI;

    if (!uri) {
      console.error("❌ CRITICAL ERROR: MONGO_URI Environment Variable is not set on Render!");
      process.exit(1);
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;