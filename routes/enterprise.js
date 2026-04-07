const router = require('express').Router();
const { getMyBusinesses, getMyBusinessById, getBusinessAnalytics, getPaymentHistory } = require('../controllers/enterpriseController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('enterprise', 'admin'));

router.get('/businesses', getMyBusinesses);
router.get('/businesses/:id', getMyBusinessById);
router.get('/analytics/:id', getBusinessAnalytics);
router.get('/payments', getPaymentHistory);

module.exports = router;
