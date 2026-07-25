const Razorpay = require('razorpay');
const crypto = require('crypto');
const Team = require('../models/Team');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

// Create Order for Custom User Entered Amount
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body; // Custom Amount entered by user

    const finalAmount = amount && Number(amount) > 0 ? Number(amount) : 50;

    const options = {
      amount: finalAmount * 100, // Convert Rupees to Paise
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
