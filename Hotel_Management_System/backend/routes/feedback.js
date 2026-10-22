const express = require('express');
const router = express.Router();

const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');
const { protect, requireRole } = require('../middleware/auth');
const { checkObjectId } = require('../middleware/validators');

const MANAGEMENT_ROLES = ['admin', 'manager'];
const ALLOWED_CATEGORIES = ['overall', 'room', 'service', 'food', 'cleanliness', 'staff', 'other'];

// Guests can submit feedback for their own booking.
router.post('/', protect, requireRole(['guest']), async (req, res) => {
  try {
    const { booking: bookingId = null, rating, category = 'overall', comment = '' } = req.body;
    const numericRating = Number(rating);

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid feedback category' });
    }

    let booking = null;
    if (bookingId) {
      booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.guest.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You can only review your own booking' });
      }
      if (!['checked-out', 'checked-in'].includes(booking.status)) {
        return res.status(400).json({ message: 'Feedback is available after or during an active stay' });
      }

      const existing = await Feedback.findOne({ guest: req.user._id, booking: booking._id });
      if (existing) return res.status(409).json({ message: 'Feedback has already been submitted for this stay' });
    }

    const feedback = await Feedback.create({
      guest: req.user._id,
      booking: booking ? booking._id : null,
      rating: numericRating,
      category,
      comment: String(comment).trim()
    });

    const populated = await Feedback.findById(feedback._id)
      .populate('guest', 'name email')
      .populate({ path: 'booking', populate: [{ path: 'room', select: 'number type' }] });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Guest's own feedback.
router.get('/mine', protect, requireRole(['guest']), async (req, res) => {
  try {
    const feedback = await Feedback.find({ guest: req.user._id })
      .populate({ path: 'booking', populate: [{ path: 'room', select: 'number type' }] })
      .sort({ createdAt: -1 });
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Management view for reporting.
router.get('/', protect, requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const feedback = await Feedback.find()
      .populate('guest', 'name email')
      .populate({ path: 'booking', populate: [{ path: 'room', select: 'number type' }] })
      .sort({ createdAt: -1 });
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', protect, requireRole(MANAGEMENT_ROLES), checkObjectId('id'), async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('guest', 'name email')
      .populate({ path: 'booking', populate: [{ path: 'room', select: 'number type' }] });
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
