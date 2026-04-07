const User = require('../models/User');
const Business = require('../models/Business');
const Payment = require('../models/Payment');
const Review = require('../models/Review');

// @desc    Dashboard stats
// @route   GET /api/admin/stats
// @access  Private (admin)
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalBusinesses,
      pendingBusinesses,
      activeBusinesses,
      totalReviews,
      payments,
    ] = await Promise.all([
      User.countDocuments(),
      Business.countDocuments(),
      Business.countDocuments({ status: 'pending' }),
      Business.countDocuments({ status: 'approved', isActive: true }),
      Review.countDocuments(),
      Payment.find({ status: 'paid' }).select('amount createdAt'),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Monthly revenue for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Role breakdown
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    // Category breakdown
    const businessesByCategory = await Business.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalBusinesses,
        pendingBusinesses,
        activeBusinesses,
        totalReviews,
        totalRevenue: totalRevenue / 100, // convert paise to rupees
        monthlyRevenue,
        usersByRole,
        businessesByCategory,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all users (with pagination & search)
// @route   GET /api/admin/users
// @access  Private (admin)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const query = {};
    if (search) query.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    if (role) query.role = role;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await User.countDocuments(query);
    res.json({ success: true, total, page: parseInt(page), users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update user role or status
// @route   PUT /api/admin/users/:id
// @access  Private (admin)
exports.updateUser = async (req, res) => {
  try {
    const { role, isActive } = req.body;
    const update = {};
    if (role && ['user', 'enterprise', 'admin'].includes(role)) update.role = role;
    if (typeof isActive === 'boolean') update.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (admin)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all businesses for admin
// @route   GET /api/admin/businesses
// @access  Private (admin)
exports.getAllBusinesses = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.name = new RegExp(search, 'i');

    const businesses = await Business.find(query)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await Business.countDocuments(query);
    res.json({ success: true, total, page: parseInt(page), businesses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Approve or reject business
// @route   PUT /api/admin/businesses/:id/review
// @access  Private (admin)
exports.reviewBusiness = async (req, res) => {
  try {
    const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve or reject' });
    }

    const update = {
      status: action === 'approve' ? 'approved' : 'rejected',
      ...(action === 'reject' && { isActive: false }),
    };
    if (action === 'reject' && rejectionReason) update.rejectionReason = rejectionReason;

    const business = await Business.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });

    res.json({ success: true, business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Admin delete business
// @route   DELETE /api/admin/businesses/:id
// @access  Private (admin)
exports.deleteBusinessAdmin = async (req, res) => {
  try {
    const business = await Business.findByIdAndDelete(req.params.id);
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });
    res.json({ success: true, message: 'Business deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Admin reassign business owner
// @route   PUT /api/admin/businesses/:id/reassign
// @access  Private (admin)
exports.reassignBusiness = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'email is required' });

    const User = require('../models/User');
    const newOwner = await User.findOne({ email: email.trim().toLowerCase() });
    if (!newOwner) return res.status(404).json({ success: false, message: `No user found with email "${email}"` });
    if (!['enterprise', 'admin'].includes(newOwner.role)) {
      return res.status(400).json({ success: false, message: 'Target user is not an enterprise user' });
    }

    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { owner: newOwner._id },
      { new: true }
    ).populate('owner', 'name email');

    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });
    res.json({ success: true, business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get revenue data
// @route   GET /api/admin/revenue
// @access  Private (admin)
exports.getRevenue = async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'paid' })
      .populate('user', 'name email')
      .populate('business', 'name category')
      .sort({ createdAt: -1 })
      .limit(50);

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({ success: true, totalRevenue: totalRevenue / 100, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
