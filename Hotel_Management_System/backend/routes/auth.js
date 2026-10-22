const express = require('express');
const router = express.Router();

const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const ResetToken = require('../models/ResetToken');

const { protect } = require('../middleware/auth');
const { createToken } = require('../utils/tokens');

router.post(
  '/register',

  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('idNumber').notEmpty(),

  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    const {
      name,
      email,
      password,
      idNumber = ''
    } = req.body;

    try {
      let user = await User.findOne({
        email: email.toLowerCase()
      });

      if (user) {
        return res.status(400).json({
          message: 'User already exists'
        });
      }

      const hashed =
        await bcrypt.hash(password, 10);

      user = new User({
        name,
        email: email.toLowerCase(),
        password: hashed,
        idNumber: String(idNumber).trim(),
        role: 'guest'
      });

      await user.save();

      res.status(201).json({
        message:
          'Guest profile created successfully'
      });

    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);


// =====================================================
// LOGIN
// =====================================================

router.post(
  '/login',

  body('email').isEmail(),
  body('password').exists(),

  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    const {
      email,
      password,
      idNumber = ''
    } = req.body;

    try {
      const user = await User.findOne({
        email: email.toLowerCase()
      });

      if (
        !user ||
        !user.password ||
        !user.isActive
      ) {
        return res.status(400).json({
          message:
            'Invalid credentials or inactive account'
        });
      }

      // Guest accounts use email + password + passport/ID
      // so a guest cannot enter the private stay portal with
      // only an email address. Staff accounts continue to use
      // email + password.
      if (user.role === 'guest') {
        const suppliedId = String(idNumber || '').trim();
        const storedId = String(user.idNumber || '').trim();

        if (!suppliedId || !storedId || suppliedId !== storedId) {
          return res.status(400).json({
            message: 'Guest passport / ID number is required and must match the profile'
          });
        }
      }

      const match =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!match) {
        return res.status(400).json({
          message: 'Invalid credentials'
        });
      }

      user.lastLogin = new Date();

      await user.save();

      const token =
        createToken(
          { id: user._id },
          '12h'
        );

      res.json({
        token,

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions:
            user.permissions || []
        }
      });

    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);


// =====================================================
// LOGOUT
// =====================================================

router.post(
  '/logout',
  protect,
  async (req, res) => {
    try {
      const authHeader =
        req.headers.authorization || '';

      const token =
        authHeader.split(' ')[1];

      if (!token) {
        return res.status(400).json({
          message: 'Token required'
        });
      }

      const decoded =
        jwt.decode(token);

      const exp =
        decoded && decoded.exp
          ? new Date(decoded.exp * 1000)
          : new Date(
              Date.now() +
              1000 * 60 * 60 * 12
            );

      await RevokedToken.create({
        token,
        expiresAt: exp
      });

      res.json({
        message: 'Logged out'
      });

    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);


// =====================================================
// PASSWORD RESET REQUEST
// =====================================================

router.post(
  '/request-reset',

  body('email').isEmail(),

  async (req, res) => {
    const errors =
      validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    const {
      email
    } = req.body;

    try {
      const user =
        await User.findOne({
          email: email.toLowerCase()
        });

      if (!user) {
        return res.status(200).json({
          message:
            'If that email exists, a reset was issued'
        });
      }

      const token =
        crypto.randomBytes(20).toString('hex');

      const expiresAt =
        new Date(
          Date.now() +
          1000 * 60 * 60
        );

      await ResetToken.create({
        user: user._id,
        token,
        expiresAt
      });

      res.json({
        message: 'Reset token created',
        token
      });

    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);


// =====================================================
// RESET PASSWORD
// =====================================================

router.post(
  '/reset',

  body('token').notEmpty(),
  body('password').isLength({ min: 6 }),

  async (req, res) => {
    const errors =
      validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    const {
      token,
      password
    } = req.body;

    try {
      const rec =
        await ResetToken.findOne({
          token
        });

      if (
        !rec ||
        rec.expiresAt < new Date()
      ) {
        return res.status(400).json({
          message:
            'Invalid or expired token'
        });
      }

      const user =
        await User.findById(rec.user);

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      user.password =
        await bcrypt.hash(
          password,
          10
        );

      await user.save();

      await ResetToken.deleteOne({
        _id: rec._id
      });

      res.json({
        message: 'Password reset'
      });

    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);


// =====================================================
// CHANGE PASSWORD
// Authenticated staff and guests can change their own password.
// =====================================================

router.post(
  '/change-password',
  protect,
  body('currentPassword').isLength({ min: 1 }),
  body('newPassword').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id);

      if (!user || !user.password) {
        return res.status(400).json({ message: 'Password account is not configured' });
      }

      const matches = await bcrypt.compare(currentPassword, user.password);
      if (!matches) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


// =====================================================
// CURRENT USER
// =====================================================

router.get(
  '/me',
  protect,
  async (req, res) => {
    res.json(req.user);
  }
);

module.exports = router;