const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Business = require('../models/Business');

const isPaymentBypassed = () => String(process.env.BYPASS_PAYMENT || 'false').toLowerCase() === 'true';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay order for business subscription
// @route   POST /api/payment/create-order
// @access  Private (enterprise)
exports.createOrder = async (req, res) => {
  try {
    const { businessId } = req.body;

    const business = await Business.findOne({ _id: businessId, owner: req.user._id });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    if (business.isActive) {
      return res.status(400).json({ success: false, message: 'Business subscription already active' });
    }
    if (business.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Business must be approved by admin before payment' });
    }

    if (isPaymentBypassed()) {
      const amount = parseInt(process.env.SUBSCRIPTION_AMOUNT || '1100', 10);
      const pseudoOrderId = `bypass_order_${Date.now()}`;
      const pseudoPaymentId = `bypass_payment_${Date.now()}`;

      await Payment.create({
        user: req.user._id,
        business: businessId,
        razorpayOrderId: pseudoOrderId,
        razorpayPaymentId: pseudoPaymentId,
        razorpaySignature: 'bypass',
        amount,
        status: 'paid',
      });

      await Business.findByIdAndUpdate(businessId, { isActive: true });

      return res.json({
        success: true,
        bypass: true,
        message: 'Payment bypass is enabled. Business activated without Razorpay.',
      });
    }

    const amount = parseInt(process.env.SUBSCRIPTION_AMOUNT || '1100', 10); // ₹11 = 1100 paise

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { businessId: businessId.toString(), userId: req.user._id.toString() },
    });

    // Save pending payment record
    const payment = await Payment.create({
      user: req.user._id,
      business: businessId,
      razorpayOrderId: order.id,
      amount,
      status: 'created',
    });

    res.json({
      success: true,
      orderId: order.id,
      amount,
      currency: 'INR',
      paymentId: payment._id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Dummy payment — activate business without real payment (dev/testing mode)
// @route   POST /api/payment/dummy-activate
// @access  Private (enterprise)
exports.dummyActivate = async (req, res) => {
  try {
    const { businessId } = req.body;
    const business = await Business.findOne({ _id: businessId, owner: req.user._id });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    if (business.isActive) {
      return res.status(400).json({ success: false, message: 'Business is already active' });
    }
    await Business.findByIdAndUpdate(businessId, { isActive: true });
    res.json({ success: true, message: 'Business activated (dummy payment).' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Verify Razorpay payment signature & activate business
// @route   POST /api/payment/verify
// @access  Private (enterprise)
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, businessId } = req.body;

    if (isPaymentBypassed()) {
      await Business.findByIdAndUpdate(businessId, { isActive: true });
      return res.json({ success: true, bypass: true, message: 'Payment bypass is enabled. Business is now active!' });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      { razorpayPaymentId, razorpaySignature, status: 'paid' },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Activate business
    await Business.findByIdAndUpdate(businessId, { isActive: true });

    res.json({ success: true, message: 'Payment verified. Business is now active!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
