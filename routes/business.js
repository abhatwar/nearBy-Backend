const router = require('express').Router();
const { body } = require('express-validator');
const {
  getAllBusinesses,
  getNearbyBusinesses,
  getBusinessById,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  trackClick,
  trackLead,
  deleteImage,
} = require('../controllers/businessController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const businessCreateRules = [
  body('name').trim().notEmpty().withMessage('Business name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
];

// Public routes
router.get('/', getAllBusinesses);
router.get('/nearby', getNearbyBusinesses);
router.get('/:id', getBusinessById);
router.post('/:id/click', trackClick);
router.post('/:id/lead', trackLead);

// Protected routes
router.post(
  '/',
  protect,
  authorize('enterprise', 'admin'),
  upload.array('images', 5),
  businessCreateRules,
  createBusiness
);

router.put(
  '/:id',
  protect,
  authorize('enterprise', 'admin'),
  upload.array('images', 5),
  updateBusiness
);

router.delete('/:id', protect, authorize('enterprise', 'admin'), deleteBusiness);
router.delete('/:id/image', protect, authorize('enterprise', 'admin'), deleteImage);

module.exports = router;
