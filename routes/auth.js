const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, getProfile, updateProfile, toggleSaveBusiness } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', registerRules, register);
router.post('/login', loginRules, login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/save/:businessId', protect, toggleSaveBusiness);

module.exports = router;
