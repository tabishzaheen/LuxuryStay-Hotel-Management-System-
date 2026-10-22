const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

const staffRoles = [
  'admin',
  'manager',
  'receptionist',
  'housekeeping',
  'maintenance'
];

const allowedRoles = [...staffRoles, 'guest'];

const allowedPermissions = [
  'dashboard',
  'staff',
  'guests',
  'reservations',
  'rooms',
  'housekeeping',
  'maintenance',
  'billing',
  'reports',
  'services',
  'settings'
];

const sanitizePermissions = (permissions = []) => (
  Array.isArray(permissions)
    ? permissions.filter((permission) =>
        allowedPermissions.includes(permission)
      )
    : []
);

const sanitizeUser = (user) => {
  const safeUser = user.toObject
    ? user.toObject()
    : { ...user };

  delete safeUser.password;

  return safeUser;
};



// =====================================================
// GUEST LOOKUP
// Front desk can select an existing guest while creating
// a reservation, but cannot manage guest profiles.
// =====================================================

router.get(
  '/guest-lookup',
  protect,
  requireRole(['admin', 'manager', 'receptionist']),
  async (req, res) => {
    try {
      const filter = { role: 'guest' };

      if (req.query.active !== undefined) {
        filter.isActive = req.query.active === 'true';
      }

      if (req.query.search?.trim()) {
        const term = req.query.search.trim();
        filter.$or = [
          { name: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
          { phone: { $regex: term, $options: 'i' } },
          { idNumber: { $regex: term, $options: 'i' } }
        ];
      }

      const guests = await User.find(filter)
        .select('_id name email phone idNumber isActive')
        .sort({ name: 1 });

      res.json(guests);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.get(
  '/me',
  protect,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.patch(
  '/me',
  protect,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const allowed = ['name', 'phone', 'address', 'preferences', 'nationality', 'idNumber'];
      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          user[field] = String(req.body[field] || '').trim();
        }
      }

      if (!user.name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      if (user.role === 'guest' && !String(user.idNumber || '').trim()) {
        return res.status(400).json({ message: 'Passport / ID number is required for guest portal access' });
      }

      await user.save();
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// =====================================================
// GET ALL USERS
// Admin only
// =====================================================

router.get(
  '/',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        role,
        active,
        type,
        search
      } = req.query;

      const filter = {};

      if (type === 'staff') {
        filter.role = { $in: staffRoles };
      } else if (type === 'guest') {
        filter.role = 'guest';
      } else if (role && allowedRoles.includes(role)) {
        filter.role = role;
      }

      if (active !== undefined) {
        filter.isActive = active === 'true';
      }

      if (search?.trim()) {
        const term = search.trim();

        filter.$or = [
          {
            name: {
              $regex: term,
              $options: 'i'
            }
          },
          {
            email: {
              $regex: term,
              $options: 'i'
            }
          },
          {
            phone: {
              $regex: term,
              $options: 'i'
            }
          },
          {
            department: {
              $regex: term,
              $options: 'i'
            }
          }
        ];
      }

      const users = await User
        .find(filter)
        .select('-password')
        .sort({ createdAt: -1 });

      res.json(users);

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// CREATE USER
// Admin creates staff or guest profile
// =====================================================

router.post(
  '/',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        name,
        email = '',
        password = '',
        role = 'guest',

        phone = '',
        department = '',
        address = '',
        preferences = '',
        notes = '',

        nationality = '',
        idNumber = '',

        permissions = [],
        isActive = true
      } = req.body;

      // -----------------------------------------------
      // Basic validation
      // -----------------------------------------------

      if (!name?.trim()) {
        return res.status(400).json({
          message: 'Full name is required'
        });
      }

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          message: 'Invalid role assigned to user'
        });
      }

      const normalizedEmail = String(email || '')
        .trim()
        .toLowerCase();

      const normalizedPassword = String(password || '');

      // -----------------------------------------------
      // Staff and Guest both need login credentials
      // -----------------------------------------------

      if (!normalizedEmail || !normalizedPassword) {
        return res.status(400).json({
          message:
            role === 'guest'
              ? 'Guest email and password are required'
              : 'Staff email and temporary password are required'
        });
      }

      if (normalizedPassword.length < 6) {
        return res.status(400).json({
          message: 'Password must be at least 6 characters'
        });
      }

      // -----------------------------------------------
      // Check duplicate email
      // -----------------------------------------------

      const existingUser = await User.findOne({
        email: normalizedEmail
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'A user with this email already exists'
        });
      }

      // -----------------------------------------------
      // Prepare user data
      // -----------------------------------------------

      const userData = {
        name: name.trim(),

        email: normalizedEmail,

        role,

        isActive: Boolean(isActive),

        phone: String(phone || '').trim(),
        department: String(department || '').trim(),
        address: String(address || '').trim(),

        preferences: String(preferences || '').trim(),
        notes: String(notes || '').trim(),

        nationality: String(nationality || '').trim(),
        idNumber: String(idNumber || '').trim(),

        permissions:
          role === 'guest'
            ? []
            : sanitizePermissions(permissions)
      };

      // -----------------------------------------------
      // Secure password for BOTH staff and guest
      // -----------------------------------------------

      userData.password = await bcrypt.hash(
        normalizedPassword,
        10
      );

      // -----------------------------------------------
      // Create user
      // -----------------------------------------------

      const user = await User.create(userData);

      res.status(201).json({
        message:
          role === 'guest'
            ? 'Guest account created successfully'
            : 'Staff account created successfully',

        user: sanitizeUser(user)
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// GET SINGLE USER
// =====================================================

router.get(
  '/:id',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const user = await User
        .findById(req.params.id)
        .select('-password');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json(user);

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// SET / RESET USER PASSWORD
// Admin only
// =====================================================

router.patch(
  '/:id/password',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          message: 'Password is required'
        });
      }

      if (String(password).length < 6) {
        return res.status(400).json({
          message: 'Password must be at least 6 characters'
        });
      }

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      user.password = await bcrypt.hash(
        String(password),
        10
      );

      await user.save();

      res.json({
        message: 'Password updated successfully'
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// UPDATE USER
// =====================================================

router.put(
  '/:id',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const updates = {
        ...req.body
      };

      // Password must only be changed
      // through /:id/password
      delete updates.password;

      // -----------------------------------------------
      // Validate role
      // -----------------------------------------------

      if (
        updates.role &&
        !allowedRoles.includes(updates.role)
      ) {
        return res.status(400).json({
          message: 'Invalid role assignment'
        });
      }

      // -----------------------------------------------
      // Admin cannot demote himself
      // -----------------------------------------------

      if (
        req.params.id === req.user._id.toString() &&
        updates.role &&
        updates.role !== 'admin'
      ) {
        return res.status(400).json({
          message:
            'You cannot change your own administrator role'
        });
      }

      // -----------------------------------------------
      // Email update
      // -----------------------------------------------

      if (updates.email !== undefined) {
        const normalizedEmail = String(
          updates.email || ''
        )
          .trim()
          .toLowerCase();

        if (normalizedEmail) {
          const duplicate = await User.findOne({
            email: normalizedEmail,
            _id: {
              $ne: req.params.id
            }
          });

          if (duplicate) {
            return res.status(400).json({
              message:
                'A user with this email already exists'
            });
          }

          updates.email = normalizedEmail;

        } else {
          updates.email = undefined;
        }
      }

      // -----------------------------------------------
      // Sanitize permissions
      // -----------------------------------------------

      if (updates.permissions) {
        updates.permissions =
          sanitizePermissions(
            updates.permissions
          );
      }

      // Guests do not need staff permissions
      if (updates.role === 'guest') {
        updates.permissions = [];
      }

      // -----------------------------------------------
      // Update user
      // -----------------------------------------------

      const user = await User
        .findByIdAndUpdate(
          req.params.id,
          updates,
          {
            new: true,
            runValidators: true
          }
        )
        .select('-password');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json({
        message: 'Profile updated',
        user
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// CHANGE ROLE
// =====================================================

router.patch(
  '/:id/role',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { role } = req.body;

      if (
        !role ||
        !allowedRoles.includes(role)
      ) {
        return res.status(400).json({
          message: 'A valid role is required'
        });
      }

      // Admin cannot demote himself
      if (
        req.params.id === req.user._id.toString() &&
        role !== 'admin'
      ) {
        return res.status(400).json({
          message:
            'You cannot change your own administrator role'
        });
      }

      const updates = {
        role
      };

      if (role === 'guest') {
        updates.permissions = [];
      }

      const user = await User
        .findByIdAndUpdate(
          req.params.id,
          updates,
          {
            new: true,
            runValidators: true
          }
        )
        .select('-password');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json({
        message: 'User role updated',
        user
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// ACTIVATE / DEACTIVATE
// =====================================================

router.patch(
  '/:id/status',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          message: 'isActive must be true or false'
        });
      }

      // Admin cannot deactivate himself
      if (
        req.params.id === req.user._id.toString() &&
        !isActive
      ) {
        return res.status(400).json({
          message:
            'You cannot deactivate your own admin account'
        });
      }

      const user = await User
        .findByIdAndUpdate(
          req.params.id,
          { isActive },
          {
            new: true,
            runValidators: true
          }
        )
        .select('-password');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json({
        message:
          isActive
            ? 'User activated'
            : 'User deactivated',

        user
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// UPDATE PERMISSIONS
// =====================================================

router.patch(
  '/:id/permissions',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      const permissions =
        sanitizePermissions(
          req.body.permissions
        );

      const user = await User
        .findByIdAndUpdate(
          req.params.id,
          { permissions },
          {
            new: true,
            runValidators: true
          }
        )
        .select('-password');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json({
        message: 'Permissions updated',
        user
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


// =====================================================
// SOFT DELETE
// Existing compatibility
// =====================================================

router.delete(
  '/:id',
  protect,
  requireRole('admin'),
  async (req, res) => {
    try {
      if (
        req.params.id === req.user._id.toString()
      ) {
        return res.status(400).json({
          message:
            'You cannot deactivate your own admin account'
        });
      }

      const user = await User
        .findByIdAndUpdate(
          req.params.id,
          { isActive: false },
          { new: true }
        )
        .select('-password');

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json({
        message: 'User deactivated',
        user
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);


module.exports = router;