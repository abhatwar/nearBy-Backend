const Business = require('../models/Business');
const Payment = require('../models/Payment');
const Review = require('../models/Review');

// @desc    Get enterprise user's own businesses
// @route   GET /api/enterprise/businesses
// @access  Private (enterprise)
exports.getMyBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, businesses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get a single business owned by the enterprise user (any status)
// @route   GET /api/enterprise/businesses/:id
// @access  Private (enterprise / admin)
exports.getMyBusinessById = async (req, res) => {
  try {
    const query =
      req.user.role === 'admin'
        ? { _id: req.params.id }
        : { _id: req.params.id, owner: req.user._id };

    const business = await Business.findOne(query).populate('owner', 'name email');
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    res.json({ success: true, business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get analytics for a specific business
// @route   GET /api/enterprise/analytics/:id
// @access  Private (enterprise - must own)
exports.getBusinessAnalytics = async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, owner: req.user._id };
    const business = await Business.findOne(query);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    // Last 30 days reviews
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentReviews = await Review.find({
      business: business._id,
      createdAt: { $gte: thirtyDaysAgo },
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    // Rating distribution
    const ratingDist = await Review.aggregate([
      { $match: { business: business._id } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      analytics: {
        views: business.views,
        clicks: business.clicks,
        leads: business.leads,
        avgRating: business.avgRating,
        reviewCount: business.reviewCount,
        ratingDistribution: ratingDist,
        recentReviews,
        status: business.status,
        isActive: business.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get payment history for enterprise user's businesses
// @route   GET /api/enterprise/payments
// @access  Private (enterprise)
exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .populate('business', 'name category')
      .sort({ createdAt: -1 });

    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
