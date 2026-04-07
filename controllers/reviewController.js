const { validationResult } = require('express-validator');
const Review = require('../models/Review');
const Business = require('../models/Business');

// @desc    Get reviews for a business  (PUBLIC)
// @route   GET /api/reviews/business/:businessId
// @access  Public
exports.getReviewsByBusiness = async (req, res) => {
  try {
    const reviews = await Review.find({ business: req.params.businessId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Add review  (auth required)
// @route   POST /api/reviews
// @access  Private
exports.addReview = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { businessId, rating, comment } = req.body;

    const business = await Business.findOne({ _id: businessId, status: 'approved', isActive: true });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const existing = await Review.findOne({ business: businessId, user: req.user._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this business' });
    }

    const review = await Review.create({
      business: businessId,
      user: req.user._id,
      rating,
      comment,
    });

    await review.populate('user', 'name avatar');
    res.status(201).json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update own review
// @route   PUT /api/reviews/:id
// @access  Private
exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { rating, comment } = req.body;
    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    await review.save();
    await review.populate('user', 'name avatar');

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete review (own or admin)
// @route   DELETE /api/reviews/:id
// @access  Private
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
