const router = require('express').Router();
const { createOrder, verifyPayment, dummyActivate } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.post('/create-order', protect, authorize('enterprise', 'admin'), createOrder);
router.post('/verify', protect, authorize('enterprise', 'admin'), verifyPayment);
router.post('/dummy-activate', protect, authorize('enterprise', 'admin'), dummyActivate);

module.exports = router;
