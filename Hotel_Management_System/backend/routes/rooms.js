const express = require('express');
const router = express.Router();

const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { protect, requireRole } = require('../middleware/auth');
const { validateRoomBody, checkObjectId } = require('../middleware/validators');

const ROOM_STATUSES = ['available', 'occupied', 'cleaning', 'maintenance'];

router.post(
  '/',
  protect,
  requireRole(['admin', 'manager']),
  validateRoomBody,
  async (req, res) => {
    try {
      const { number, type, floor = '', price, status = 'available', amenities = [] } = req.body;
      const normalizedNumber = String(number).trim();

      const existingRoom = await Room.findOne({ number: normalizedNumber });
      if (existingRoom) {
        return res.status(409).json({ message: `Room ${normalizedNumber} already exists` });
      }

      const room = await Room.create({
        number: normalizedNumber,
        type: String(type).trim(),
        floor: String(floor).trim(),
        price: Number(price),
        status: String(status).toLowerCase(),
        amenities: Array.isArray(amenities)
          ? amenities.map((item) => String(item).trim()).filter(Boolean)
          : []
      });

      res.status(201).json(room);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'A room with this number already exists' });
      }
      res.status(500).json({ message: error.message });
    }
  }
);

router.get('/', protect, async (req, res) => {
  try {
    const { status, search, type } = req.query;
    const filter = {};

    if (status && ROOM_STATUSES.includes(String(status).toLowerCase())) {
      filter.status = String(status).toLowerCase();
    }

    if (type?.trim()) {
      filter.type = { $regex: type.trim(), $options: 'i' };
    }

    if (search?.trim()) {
      const term = search.trim();
      filter.$or = [
        { number: { $regex: term, $options: 'i' } },
        { type: { $regex: term, $options: 'i' } },
        { floor: { $regex: term, $options: 'i' } },
        { amenities: { $regex: term, $options: 'i' } }
      ];
    }

    const rooms = await Room.find(filter).sort({ number: 1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stats/summary', protect, async (req, res) => {
  try {
    const stats = await Room.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const summary = { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
    stats.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(summary, item._id)) {
        summary[item._id] = item.count;
      }
    });
    summary.total = summary.available + summary.occupied + summary.cleaning + summary.maintenance;

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', protect, checkObjectId('id'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put(
  '/:id',
  protect,
  requireRole(['admin', 'manager']),
  checkObjectId('id'),
  validateRoomBody,
  async (req, res) => {
    try {
      const { number, type, floor, price, status, amenities } = req.body;
      const room = await Room.findById(req.params.id);
      if (!room) return res.status(404).json({ message: 'Room not found' });

      if (number !== undefined) {
        const normalizedNumber = String(number).trim();
        const duplicateRoom = await Room.findOne({ number: normalizedNumber, _id: { $ne: room._id } });
        if (duplicateRoom) {
          return res.status(409).json({ message: `Room ${normalizedNumber} already exists` });
        }
        room.number = normalizedNumber;
      }

      if (type !== undefined) room.type = String(type).trim();
      if (floor !== undefined) room.floor = String(floor).trim();
      if (price !== undefined) room.price = Number(price);
      if (status !== undefined) room.status = String(status).toLowerCase();
      if (amenities !== undefined) {
        room.amenities = Array.isArray(amenities)
          ? amenities.map((item) => String(item).trim()).filter(Boolean)
          : [];
      }

      await room.save();
      res.json(room);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'A room with this number already exists' });
      }
      res.status(500).json({ message: error.message });
    }
  }
);

router.patch(
  '/:id/status',
  protect,
  requireRole(['admin', 'manager', 'housekeeping']),
  checkObjectId('id'),
  async (req, res) => {
    try {
      const normalizedStatus = String(req.body.status || '').toLowerCase();
      if (!ROOM_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ message: 'Invalid room status. Allowed values: available, occupied, cleaning, maintenance' });
      }

      const room = await Room.findById(req.params.id);
      if (!room) return res.status(404).json({ message: 'Room not found' });

      if (normalizedStatus === 'available') {
        const activeBooking = await Booking.findOne({
          room: room._id,
          status: { $in: ['reserved', 'checked-in'] },
          checkOut: { $gt: new Date() }
        });
        if (activeBooking) {
          return res.status(409).json({ message: 'Room cannot be marked available because it has an active booking' });
        }
      }

      room.status = normalizedStatus;
      await room.save();
      res.json({ message: 'Room status updated successfully', room });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.delete(
  '/:id',
  protect,
  requireRole(['admin', 'manager']),
  checkObjectId('id'),
  async (req, res) => {
    try {
      const room = await Room.findById(req.params.id);
      if (!room) return res.status(404).json({ message: 'Room not found' });

      const bookingExists = await Booking.exists({ room: room._id });
      if (bookingExists) {
        return res.status(409).json({ message: 'This room cannot be deleted because booking records are associated with it. Update its status instead.' });
      }

      await room.deleteOne();
      res.json({ message: `Room ${room.number} deleted successfully` });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
