const express = require('express');
const { check, validationResult } = require('express-validator');
const { signup, verifyEmail, verifyMobile } = require('../controllers/authController');

const router = express.Router();

router.post('/signup', [
  check('firstName').not().isEmpty().withMessage('First name is required'),
  check('lastName').not().isEmpty().withMessage('Last name is required'),
  check('email').isEmail().withMessage('Valid email is required'),
  check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  check('mobile').isMobilePhone().withMessage('Valid mobile number is required')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}, signup);

router.get('/verify-email', verifyEmail);
router.post('/verify-mobile', verifyMobile);

module.exports = router;