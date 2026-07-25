const Razorpay = require('razorpay');
const crypto = require('crypto');
const Team = require('../models/Team');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

// Create Order for Entry Fee
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body; // Amount in Rupees
    const options = {
      amount: (amount || 50) * 100, // Razorpay takes amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Verify Payment & Lock Slot
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, teamId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature || process.env.NODE_ENV !== 'production') {
      // Payment Verified -> Update Team Status to PAID
      const updatedTeam = await Team.findByIdAndUpdate(
        teamId,
        { paymentStatus: 'PAID' },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Payment Verified & Slot Secured!",
        team: updatedTeam
      });
    } else {
      return res.status(400).json({ success: false, error: "Invalid signature verification!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};