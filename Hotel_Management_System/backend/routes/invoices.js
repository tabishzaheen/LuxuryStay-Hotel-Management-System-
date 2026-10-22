const express = require('express');
const router = express.Router();

const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const Settings = require('../models/Settings');
const { protect, requireRole } = require('../middleware/auth');
const { validateInvoiceBody, checkObjectId } = require('../middleware/validators');

const staffRoles = ['admin', 'manager', 'receptionist'];

function nightsBetween(checkIn, checkOut) {
  return Math.max(
    1,
    Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
  );
}

function buildInvoiceItems(booking, extraItems = []) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const roomPrice = Number(booking.room?.price || 0);
  const roomTotal = nights * roomPrice;

  const items = [
    {
      description: `Room ${booking.room?.number || '—'} · ${nights} night(s) × $${roomPrice}`,
      amount: roomTotal
    }
  ];

  for (const service of booking.services || []) {
    const quantity = Math.max(1, Number(service.quantity || 1));
    const unitPrice = Number(service.price || 0);
    items.push({
      description: `${service.name} · ${quantity} × $${unitPrice}`,
      amount: quantity * unitPrice
    });
  }

  for (const item of extraItems) {
    const amount = Number(item.amount);
    if (item.description?.trim() && Number.isFinite(amount) && amount >= 0) {
      items.push({
        description: item.description.trim(),
        amount
      });
    }
  }

  return items;
}

async function getBookingForInvoice(bookingId) {
  return Booking.findById(bookingId).populate('room').populate('guest', 'name email phone');
}

// Create one invoice for a booking. If one already exists, return it instead
// of creating duplicate invoices for the same stay.
router.post(
  '/',
  protect,
  requireRole(staffRoles),
  validateInvoiceBody,
  async (req, res) => {
    try {
      const booking = await getBookingForInvoice(req.body.bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      const existing = await Invoice.findOne({ booking: booking._id });
      if (existing) {
        return res.json(existing);
      }

      const items = buildInvoiceItems(booking, Array.isArray(req.body.items) ? req.body.items : []);
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const settings = await Settings.findOne({ key: 'hotel' }).lean();
      const taxRate = Number(settings?.taxRate || 0);
      const tax = Number((subtotal * taxRate / 100).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));

      const invoice = await Invoice.create({
        booking: booking._id,
        items,
        subtotal,
        taxRate,
        tax,
        total
      });

      booking.invoice = invoice._id;
      await booking.save();

      res.status(201).json(invoice);
    } catch (err) {
      if (err?.code === 11000 && err?.keyPattern?.booking) {
        const existing = await Invoice.findOne({ booking: req.body.bookingId });
        if (existing) return res.json(existing);
      }
      res.status(500).json({ message: err.message });
    }
  }
);

router.get(
  '/',
  protect,
  requireRole(staffRoles),
  async (req, res) => {
    try {
      const invoices = await Invoice.find()
        .populate({
          path: 'booking',
          populate: [
            { path: 'guest', select: 'name email phone' },
            { path: 'room' }
          ]
        })
        .sort({ issuedAt: -1 });

      res.json(invoices);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.get(
  '/mine',
  protect,
  requireRole('guest'),
  async (req, res) => {
    try {
      const bookings = await Booking.find({ guest: req.user._id }).select('_id');
      const invoices = await Invoice.find({
        booking: { $in: bookings.map((booking) => booking._id) }
      })
        .populate({
          path: 'booking',
          populate: [
            { path: 'guest', select: 'name email phone' },
            { path: 'room' }
          ]
        })
        .sort({ issuedAt: -1 });

      res.json(invoices);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.get(
  '/:id',
  protect,
  checkObjectId('id'),
  async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id).populate({
        path: 'booking',
        populate: [
          { path: 'guest', select: 'name email phone' },
          { path: 'room' }
        ]
      });

      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

      if (req.user.role === 'guest') {
        const ownerId = invoice.booking?.guest?._id?.toString() || invoice.booking?.guest?.toString();
        if (ownerId !== req.user._id.toString()) {
          return res.status(403).json({ message: 'You can only view your own invoices' });
        }
      } else if (!staffRoles.includes(req.user.role) && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: insufficient role' });
      }

      res.json(invoice);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.put(
  '/:id/pay',
  protect,
  requireRole(staffRoles),
  checkObjectId('id'),
  async (req, res) => {
    try {
      const invoice = await Invoice.findByIdAndUpdate(
        req.params.id,
        { paid: true },
        { new: true }
      );

      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
      res.json(invoice);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
