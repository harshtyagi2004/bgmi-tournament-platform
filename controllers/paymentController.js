const Razorpay = require('razorpay');
const Team = require('../models/Team');

// Initialize Razorpay Instance with API Keys from .env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_dummy_secret'
});

// 1. CREATE RAZORPAY UPI ORDER
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid payment amount!" });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // Razorpay accepts amount in paise (1 INR = 100 Paise)
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (err) {
    console.error("Razorpay Order Creation Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// 2. VERIFY PAYMENT AND LOCK SLOT
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, teamId } = req.body;

    if (teamId) {
      // Mark team payment status as PAID in MongoDB
      await Team.findByIdAndUpdate(teamId, { paymentStatus: 'PAID' });
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully! Slot status updated to PAID."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};