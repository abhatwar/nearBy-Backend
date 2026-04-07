const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
      trim: true,
    },
  },
  { timestamps: true }
);

// One review per user per business
reviewSchema.index({ business: 1, user: 1 }, { unique: true });

// After save: recalculate business avgRating & reviewCount
reviewSchema.post('save', async function () {
  await recalcRating(this.business);
});

// After remove: recalculate
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await recalcRating(doc.business);
});

async function recalcRating(businessId) {
  const Review = mongoose.model('Review');
  const Business = mongoose.model('Business');
  const result = await Review.aggregate([
    { $match: { business: businessId } },
    { $group: { _id: '$business', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (result.length > 0) {
    await Business.findByIdAndUpdate(businessId, {
      avgRating: Math.round(result[0].avgRating * 10) / 10,
      reviewCount: result[0].count,
    });
  } else {
    await Business.findByIdAndUpdate(businessId, { avgRating: 0, reviewCount: 0 });
  }
}

module.exports = mongoose.model('Review', reviewSchema);
