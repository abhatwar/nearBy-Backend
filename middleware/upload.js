const multer = require('multer');

const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const cloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

let storage;

if (cloudinaryConfigured) {
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  const cloudinary = require('../config/cloudinary');
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'nearby_finder/businesses',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }],
    },
  });
  console.log('📦 Upload: Cloudinary storage enabled');
} else {
  // Cloudinary not configured — use memory storage (images will not be persisted)
  storage = multer.memoryStorage();
  console.log('⚠️  Upload: Cloudinary not configured, using memory storage (images will not be saved)');
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10 MB per file, max 5 files
});

// Export a wrapper that normalises file paths whether using Cloudinary or memory
upload.normaliseFiles = (req) => {
  if (!req.files || req.files.length === 0) return [];
  if (cloudinaryConfigured) {
    return req.files.map((f) => f.path); // Cloudinary returns a URL in f.path
  }
  // Memory storage: no persistent URL available
  return [];
};

module.exports = upload;
