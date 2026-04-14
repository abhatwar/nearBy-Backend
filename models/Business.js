const mongoose = require('mongoose');

const CATEGORIES = [
  'restaurant',
  'hospital',
  'hotel',
  'gym',
  'salon',
  'pharmacy',
  'grocery',
  'bank',
  'education',
  'entertainment',
  'other',
];

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: CATEGORIES,
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    images: [{ type: String }], // Cloudinary URLs
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates are required'],
        validate: {
          validator: (v) => v.length === 2,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
      city: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    contactInfo: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      website: { type: String, trim: true },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Admin approval workflow
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String },
    // Active only after payment
    isActive: { type: Boolean, default: false },
    // Analytics
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    // Computed from reviews
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 2dsphere index for geospatial queries
businessSchema.index({ location: '2dsphere' });
businessSchema.index({ category: 1, status: 1, isActive: 1 });
businessSchema.index({ 'location.city': 1, status: 1, isActive: 1 });

module.exports = mongoose.model('Business', businessSchema);
