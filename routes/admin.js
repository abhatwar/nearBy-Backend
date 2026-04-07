const router = require('express').Router();
const {
  getDashboardStats,
  getAllUsers,
  updateUser,
  deleteUser,
  getAllBusinesses,
  reviewBusiness,
  deleteBusinessAdmin,
  reassignBusiness,
  getRevenue,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/businesses', getAllBusinesses);
router.put('/businesses/:id/review', reviewBusiness);
router.put('/businesses/:id/reassign', reassignBusiness);
router.delete('/businesses/:id', deleteBusinessAdmin);
router.get('/revenue', getRevenue);

module.exports = router;
