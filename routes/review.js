const router = require('express').Router();
const { body } = require('express-validator');
const { getReviewsByBusiness, addReview, updateReview, deleteReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

// Public
router.get('/business/:businessId', getReviewsByBusiness);

// Protected
router.post(
  '/',
  protect,
  [
    body('businessId').notEmpty().withMessage('Business ID required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1 to 5'),
    body('comment').optional().isLength({ max: 500 }).withMessage('Comment max 500 chars'),
  ],
  addReview
);

router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
