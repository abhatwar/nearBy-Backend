const { validationResult } = require('express-validator');
const Business = require('../models/Business');
const cloudinary = require('../config/cloudinary');
const upload = require('../middleware/upload');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get all active businesses, optionally filtered (PUBLIC)
// @route   GET /api/businesses
// @access  Public
exports.getAllBusinesses = async (req, res) => {
  try {
    const { category, minRating, search, city, page = 1, limit = 20 } = req.query;
    const query = { status: 'approved', isActive: true };
    if (category) query.category = category;
    if (minRating) query.avgRating = { $gte: parseFloat(minRating) };
    if (search) query.name = { $regex: search, $options: 'i' };
    if (city) {
      const cityRegex = { $regex: `^${escapeRegex(city.trim())}$`, $options: 'i' };
      query.$or = [
        { 'location.city': cityRegex },
        { 'location.address': { $regex: escapeRegex(city.trim()), $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const businesses = await Business.find(query)
      .select('name category description images location contactInfo avgRating reviewCount')
      .sort({ avgRating: -1, reviewCount: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({ success: true, count: businesses.length, businesses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get nearby businesses  (PUBLIC)
// @route   GET /api/businesses/nearby
// @access  Public
exports.getNearbyBusinesses = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 5000,
      category,
      minRating,
      search,
      city,
      page = 1,
      limit = 20,
      fallback = 'false',
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    const maxDistance = parseInt(radius, 10); // metres

    if (isNaN(longitude) || isNaN(latitude)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const allowFallback = String(fallback).toLowerCase() === 'true';

    const matchStage = { status: 'approved', isActive: true };
    if (category) matchStage.category = category;
    if (minRating) matchStage.avgRating = { $gte: parseFloat(minRating) };
    if (search) matchStage.name = { $regex: search, $options: 'i' };
    if (city) {
      const cityRegex = { $regex: `^${escapeRegex(city.trim())}$`, $options: 'i' };
      matchStage.$or = [
        { 'location.city': cityRegex },
        { 'location.address': { $regex: escapeRegex(city.trim()), $options: 'i' } },
      ];
    }

    const projectStage = {
      $project: {
        name: 1, category: 1, description: 1,
        images: { $slice: ['$images', 1] },
        location: 1, contactInfo: 1, avgRating: 1,
        reviewCount: 1, distance: 1, views: 1,
      },
    };

    let businesses = await Business.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distance',
          maxDistance,
          spherical: true,
          query: matchStage,
        },
      },
      { $skip: skip },
      { $limit: parseInt(limit, 10) },
      projectStage,
    ]);

    // Optional: if nothing found within radius, return nearest results without maxDistance
    let outsideRadius = false;
    if (allowFallback && businesses.length === 0) {
      businesses = await Business.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [longitude, latitude] },
            distanceField: 'distance',
            spherical: true,
            query: matchStage,
          },
        },
        { $limit: parseInt(limit, 10) },
        projectStage,
      ]);
      outsideRadius = true;
    }

    res.json({ success: true, count: businesses.length, businesses, outsideRadius, radius: maxDistance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get business by ID  (PUBLIC)
// @route   GET /api/businesses/:id
// @access  Public
exports.getBusinessById = async (req, res) => {
  try {
    const business = await Business.findOne({
      _id: req.params.id,
      status: 'approved',
      isActive: true,
    }).populate('owner', 'name email');

    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    // Increment view count
    business.views += 1;
    await business.save();

    res.json({ success: true, business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create business
// @route   POST /api/businesses
// @access  Private (enterprise)
exports.createBusiness = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, category, description, lat, lng, city, address, phone, email, website } = req.body;

    // Handle uploaded images
    const images = upload.normaliseFiles(req);

    const business = await Business.create({
      name,
      category,
      description,
      images,
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)],
        city,
        address,
      },
      contactInfo: { phone, email, website },
      owner: req.user._id,
      status: 'pending',
      isActive: false,
    });

    res.status(201).json({ success: true, business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update business
// @route   PUT /api/businesses/:id
// @access  Private (owner enterprise or admin)
exports.updateBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    // Only owner or admin
    if (business.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { name, category, description, lat, lng, city, address, phone, email, website } = req.body;

    if (name) business.name = name;
    if (category) business.category = category;
    if (description) business.description = description;
    if (lat && lng) {
      business.location.coordinates = [parseFloat(lng), parseFloat(lat)];
    }
    if (city) business.location.city = city;
    if (address) business.location.address = address;
    if (phone) business.contactInfo.phone = phone;
    if (email) business.contactInfo.email = email;
    if (website) business.contactInfo.website = website;

    // New images uploaded
    const newImages = upload.normaliseFiles(req);
    if (newImages.length > 0) {
      business.images = [...business.images, ...newImages];
    }

    // Re-submit for approval if non-admin edits
    if (req.user.role !== 'admin') {
      business.status = 'pending';
    }

    await business.save();
    res.json({ success: true, business });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete business
// @route   DELETE /api/businesses/:id
// @access  Private (owner enterprise or admin)
exports.deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    if (business.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete cloudinary images
    for (const imgUrl of business.images) {
      try {
        const parts = imgUrl.split('/');
        const folder = parts[parts.length - 2];
        const filename = parts[parts.length - 1].split('.')[0];
        await cloudinary.uploader.destroy(`${folder}/${filename}`);
      } catch (_) { /* ignore cloudinary errors */ }
    }

    await business.deleteOne();
    res.json({ success: true, message: 'Business deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Track click on a business
// @route   POST /api/businesses/:id/click
// @access  Public
exports.trackClick = async (req, res) => {
  try {
    await Business.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Track lead (contact form submit, phone click, etc.)
// @route   POST /api/businesses/:id/lead
// @access  Public
exports.trackLead = async (req, res) => {
  try {
    await Business.findByIdAndUpdate(req.params.id, { $inc: { leads: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete a business image
// @route   DELETE /api/businesses/:id/image
// @access  Private (owner or admin)
exports.deleteImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });

    if (business.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Remove from cloudinary
    try {
      const parts = imageUrl.split('/');
      const folder = parts[parts.length - 2];
      const filename = parts[parts.length - 1].split('.')[0];
      await cloudinary.uploader.destroy(`${folder}/${filename}`);
    } catch (_) { /* ignore */ }

    business.images = business.images.filter((img) => img !== imageUrl);
    await business.save();
    res.json({ success: true, images: business.images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
