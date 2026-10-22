const express = require('express');
const router = express.Router();

const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Room = require('../models/Room');
const { protect, requireRole } = require('../middleware/auth');
const { checkObjectId } = require('../middleware/validators');
const { createNotification } = require('../utils/notifications');

const STAFF_ROLES = ['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance'];
const ASSIGNABLE_ROLES = ['admin', 'manager', 'receptionist', 'housekeeping', 'maintenance'];
const TYPES = ['room-service', 'wake-up-call', 'transportation', 'laundry', 'housekeeping', 'concierge', 'other'];
const STATUSES = ['requested', 'confirmed', 'in-progress', 'completed', 'cancelled'];

async function populateRequest(id) {
  return ServiceRequest.findById(id)
    .populate('service', 'name description price')
    .populate('guest', 'name email phone')
    .populate('booking', 'checkIn checkOut status')
    .populate('room', 'number type status')
    .populate('assignedTo', 'name email role')
    .sort({ createdAt: -1 });
}

router.post('/', protect, requireRole([...STAFF_ROLES, 'guest']), async (req, res) => {
  try {
    const {
      service: serviceId = null,
      booking: bookingId = null,
      room: roomId = null,
      serviceType = 'other',
      quantity = 1,
      requestedFor = null,
      notes = '',
      assignedTo = null
    } = req.body;

    if (!serviceId && !String(req.body.serviceName || '').trim()) {
      return res.status(400).json({ message: 'Select a service' });
    }
    if (!TYPES.includes(serviceType)) return res.status(400).json({ message: 'Invalid service type' });
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) return res.status(400).json({ message: 'Quantity must be a positive whole number' });

    let service = null;
    if (serviceId) {
      service = await Service.findById(serviceId);
      if (!service) return res.status(404).json({ message: 'Service not found' });
    }

    let booking = null;
    if (bookingId) {
      booking = await Booking.findById(bookingId).populate('room');
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (req.user.role === 'guest' && booking.guest.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'You can only request services for your own booking' });
      if (['cancelled', 'checked-out'].includes(booking.status)) return res.status(400).json({ message: 'Services cannot be requested for a closed reservation' });
    }

    let room = null;
    if (roomId) {
      room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ message: 'Room not found' });
      if (req.user.role === 'guest' && booking && booking.room._id.toString() !== room._id.toString()) return res.status(403).json({ message: 'Room does not belong to your booking' });
    } else if (booking?.room) {
      room = booking.room;
    }

    if (req.user.role === 'guest' && !booking) {
      const activeBooking = await Booking.findOne({ guest: req.user._id, status: { $in: ['reserved', 'checked-in'] } }).sort({ checkIn: 1 });
      if (activeBooking) booking = activeBooking;
      if (booking?.room) room = await Room.findById(booking.room);
    }

    let assignee = null;
    if (assignedTo) {
      if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Only management can assign service requests' });
      assignee = await User.findById(assignedTo).select('name email role isActive');
      if (!assignee || !ASSIGNABLE_ROLES.includes(assignee.role) || assignee.isActive === false) return res.status(400).json({ message: 'Invalid or inactive service assignee' });
    }

    const guestId = req.user.role === 'guest' ? req.user._id : booking?.guest;
    if (!guestId) return res.status(400).json({ message: 'A guest or booking is required for a service request' });

    const request = await ServiceRequest.create({
      service: service?._id || null,
      guest: guestId,
      booking: booking?._id || null,
      room: room?._id || null,
      serviceName: service?.name || String(req.body.serviceName).trim(),
      serviceType,
      quantity: Number(quantity),
      price: Number(service?.price || req.body.price || 0),
      requestedFor: requestedFor ? new Date(requestedFor) : null,
      notes: String(notes).trim(),
      assignedTo: assignee?._id || null
    });

    await createNotification({
      audienceRoles: ['admin', 'manager', 'receptionist', 'housekeeping'],
      type: 'service',
      title: 'New guest service request',
      message: `${service?.name || request.serviceName}${room ? ` for Room ${room.number}` : ''} has been requested.`,
      link: '/services',
      settingKey: 'serviceRequest'
    });

    res.status(201).json(await populateRequest(request._id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/mine', protect, requireRole('guest'), async (req, res) => {
  try {
    const requests = await ServiceRequest.find({ guest: req.user._id })
      .populate('service', 'name description price')
      .populate('booking', 'checkIn checkOut status')
      .populate('room', 'number type status')
      .populate('assignedTo', 'name role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/', protect, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const requests = await ServiceRequest.find(filter)
      .populate('service', 'name description price')
      .populate('guest', 'name email phone')
      .populate('booking', 'checkIn checkOut status')
      .populate('room', 'number type status')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put('/:id', protect, requireRole(STAFF_ROLES), checkObjectId('id'), async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Service request not found' });

    const { status, assignedTo, quantity, requestedFor, notes } = req.body;
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid service request status' });
      request.status = status;
      request.completedAt = status === 'completed' ? new Date() : null;
    }
    if (quantity !== undefined) {
      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) return res.status(400).json({ message: 'Quantity must be a positive whole number' });
      request.quantity = Number(quantity);
    }
    if (requestedFor !== undefined) request.requestedFor = requestedFor ? new Date(requestedFor) : null;
    if (notes !== undefined) request.notes = String(notes).trim();
    if (assignedTo !== undefined) {
      if (assignedTo === '' || assignedTo === null) request.assignedTo = null;
      else {
        const assignee = await User.findById(assignedTo).select('role isActive');
        if (!assignee || !ASSIGNABLE_ROLES.includes(assignee.role) || assignee.isActive === false) return res.status(400).json({ message: 'Invalid or inactive service assignee' });
        request.assignedTo = assignee._id;
      }
    }
    await request.save();
    res.json(await populateRequest(request._id));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
