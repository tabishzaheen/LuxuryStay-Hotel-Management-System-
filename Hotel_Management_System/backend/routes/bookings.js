const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const router = express.Router();

const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Room = require('../models/Room');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Settings = require('../models/Settings');
const { createNotification } = require('../utils/notifications');

const {
  protect,
  requireRole
} = require('../middleware/auth');

const {
  validateBookingBody,
  checkObjectId
} = require('../middleware/validators');

const staffRoles = [
  'admin',
  'manager',
  'receptionist'
];


// =====================================================
// HELPERS
// =====================================================

async function findOverlappingBooking(
  roomId,
  checkIn,
  checkOut,
  excludeId = null
) {
  const query = {
    room: roomId,

    status: {
      $in: [
        'reserved',
        'checked-in'
      ]
    },

    checkIn: {
      $lt: checkOut
    },

    checkOut: {
      $gt: checkIn
    }
  };

  if (excludeId) {
    query._id = {
      $ne: excludeId
    };
  }

  return Booking.findOne(query);
}


function nightsBetween(
  checkIn,
  checkOut
) {
  return Math.max(
    1,
    Math.ceil(
      (
        new Date(checkOut) -
        new Date(checkIn)
      ) /
      (1000 * 60 * 60 * 24)
    )
  );
}


function createKeyCode() {
  return crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase();
}


async function createInvoiceForBooking(
  booking
) {
  if (booking.invoice) {
    return Invoice.findById(
      booking.invoice
    );
  }

  const existing =
    await Invoice.findOne({
      booking: booking._id
    });

  if (existing) {
    booking.invoice =
      existing._id;

    await booking.save();

    return existing;
  }

  const nights = nightsBetween(
    booking.checkIn,
    booking.checkOut
  );

  const roomPrice =
    Number(booking.room?.price || 0);

  const items = [
    {
      description:
        `Room ${booking.room?.number || '—'} · ${nights} night(s) × $${roomPrice}`,
      amount:
        nights * roomPrice
    }
  ];

  for (const service of booking.services || []) {
    const quantity = Math.max(
      1,
      Number(service.quantity || 1)
    );

    const unitPrice =
      Number(service.price || 0);

    items.push({
      description:
        `${service.name} · ${quantity} × $${unitPrice}`,
      amount:
        quantity * unitPrice
    });
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const settings = await Settings.findOne({ key: 'hotel' }).lean();
  const taxRate = Number(settings?.taxRate || 0);
  const tax = Number((subtotal * taxRate / 100).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  const invoice =
    await Invoice.create({
      booking: booking._id,
      subtotal,
      taxRate,
      tax,
      total,
      items
    });

  booking.invoice =
    invoice._id;

  await booking.save();

  return invoice;
}


async function getPopulatedBooking(id) {
  return Booking
    .findById(id)
    .populate('guest', 'name email phone')
    .populate('room')
    .populate('invoice');
}


function bookingServicesLocked(booking) {
  return booking.status === 'checked-out' || booking.status === 'cancelled';
}


// =====================================================
// ROOM AVAILABILITY
// GET /api/bookings/availability
// =====================================================

router.get(
  '/availability',
  async (req, res) => {

    try {

      const {
        checkIn,
        checkOut
      } = req.query;

      const ci =
        new Date(checkIn);

      const co =
        new Date(checkOut);

      if (
        Number.isNaN(ci.getTime()) ||
        Number.isNaN(co.getTime()) ||
        ci >= co
      ) {
        return res.status(400).json({
          message:
            'Valid check-in and check-out dates are required'
        });
      }


      const rooms =
        await Room
          .find()
          .sort({
            number: 1
          });


      const bookings =
        await Booking.find({
          status: {
            $in: [
              'reserved',
              'checked-in'
            ]
          },

          checkIn: {
            $lt: co
          },

          checkOut: {
            $gt: ci
          }

        }).select('room');


      const bookedIds =
        new Set(
          bookings.map(
            (booking) =>
              booking.room.toString()
          )
        );


      res.json(
        rooms.map(
          (room) => ({
            ...room.toObject(),

            availableForBooking:
              room.status !== 'maintenance' &&
              room.status !== 'cleaning' &&
              !bookedIds.has(
                room._id.toString()
              )
          })
        )
      );

    } catch (err) {

      res.status(500).json({
        message: err.message
      });

    }
  }
);


// =====================================================
// STAFF RESERVATION CREATION
// =====================================================

router.post(
  '/',
  protect,
  requireRole(staffRoles),
  validateBookingBody,

  async (req, res) => {

    try {

      const {
        room: roomId,
        checkIn,
        checkOut,
        guest
      } = req.body;


      if (!guest) {
        return res.status(400).json({
          message:
            'A guest profile is required'
        });
      }


      const guestUser =
        await User.findOne({
          _id: guest,
          role: 'guest',
          isActive: true
        });


      if (!guestUser) {
        return res.status(400).json({
          message:
            'Select a valid active guest profile'
        });
      }


      const room =
        await Room.findById(roomId);


      if (!room) {
        return res.status(404).json({
          message:
            'Room not found'
        });
      }


      if (
        [
          'maintenance',
          'cleaning'
        ].includes(room.status)
      ) {
        return res.status(400).json({
          message:
            `Room ${room.number} is currently ${room.status}`
        });
      }


      const ci =
        new Date(checkIn);

      const co =
        new Date(checkOut);


      const overlapping =
        await findOverlappingBooking(
          roomId,
          ci,
          co
        );


      if (overlapping) {
        return res.status(409).json({
          message:
            'Room is already reserved for the selected dates'
        });
      }


      const booking =
        await Booking.create({

          guest:
            guestUser._id,

          room:
            room._id,

          checkIn:
            ci,

          checkOut:
            co,

          source:
            'front-desk',

          totalPrice:
            nightsBetween(ci, co) *
            room.price
        });


      const populated =
        await Booking
          .findById(
            booking._id
          )
          .populate(
            'guest',
            'name email phone'
          )
          .populate(
            'room'
          );


      await createNotification({
        audienceRoles: ['admin', 'manager', 'receptionist'],
        type: 'booking',
        title: 'New reservation created',
        message: `Room ${room.number} has a new reservation for ${guestUser.name}.`,
        link: '/reservations',
        settingKey: 'newReservation'
      });

      res.status(201).json(
        populated
      );

    } catch (err) {

      res.status(500).json({
        message:
          err.message
      });

    }
  }
);


// =====================================================
// PUBLIC ONLINE RESERVATION
// =====================================================

router.post(
  '/public',
  validateBookingBody,

  async (req, res) => {

    try {

      const {
        guestName,
        guestEmail,
        guestPhone = '',
        guestIdNumber = '',
        guestPassword = '',
        room: roomId,
        checkIn,
        checkOut
      } = req.body;


      if (
        !guestName?.trim() ||
        !guestEmail?.trim()
      ) {
        return res.status(400).json({
          message:
            'Guest name and email are required'
        });
      }

      const cleanGuestIdNumber = String(guestIdNumber || '').trim();
      const cleanGuestPassword = String(guestPassword || '');
      if (cleanGuestPassword && cleanGuestPassword.length < 6) {
        return res.status(400).json({ message: 'Guest password must be at least 6 characters' });
      }


      const room =
        await Room.findById(
          roomId
        );


      if (!room) {
        return res.status(404).json({
          message:
            'Room not found'
        });
      }


      if (
        [
          'maintenance',
          'cleaning'
        ].includes(room.status)
      ) {
        return res.status(400).json({
          message:
            `Room ${room.number} is not currently available`
        });
      }


      const ci =
        new Date(checkIn);

      const co =
        new Date(checkOut);


      const overlapping =
        await findOverlappingBooking(
          roomId,
          ci,
          co
        );


      if (overlapping) {
        return res.status(409).json({
          message:
            'Room is no longer available for the selected dates'
        });
      }


      const normalizedEmail =
        guestEmail
          .trim()
          .toLowerCase();


      let guest =
        await User.findOne({
          email: normalizedEmail
        });

      if (guest && guest.role !== 'guest') {
        return res.status(400).json({
          message: 'This email belongs to a staff account. Please book with a guest email address.'
        });
      }

      if (!guest) {
        if (!cleanGuestPassword || !cleanGuestIdNumber) {
          return res.status(400).json({
            message: 'New online guests must provide a password and passport / ID number for guest portal access'
          });
        }

        guest =
          await User.create({
            name: guestName.trim(),
            email: normalizedEmail,
            phone: guestPhone.trim(),
            idNumber: cleanGuestIdNumber,
            password: await bcrypt.hash(cleanGuestPassword, 10),
            role: 'guest',
            isActive: true
          });

      } else {
        if (guest.isActive === false) {
          return res.status(400).json({
            message: 'This guest account is inactive. Please contact the hotel.'
          });
        }

        let changed = false;
        if (guestPhone.trim() && !guest.phone) {
          guest.phone = guestPhone.trim();
          changed = true;
        }
        if (cleanGuestIdNumber && !guest.idNumber) {
          guest.idNumber = cleanGuestIdNumber;
          changed = true;
        }
        if (cleanGuestPassword && !guest.password) {
          guest.password = await bcrypt.hash(cleanGuestPassword, 10);
          changed = true;
        }
        if (changed) await guest.save();
      }


      const booking =
        await Booking.create({

          guest:
            guest._id,

          room:
            room._id,

          checkIn:
            ci,

          checkOut:
            co,

          source:
            'online',

          totalPrice:
            nightsBetween(ci, co) *
            room.price

        });


      const populated =
        await Booking
          .findById(
            booking._id
          )
          .populate(
            'guest',
            'name email phone'
          )
          .populate(
            'room'
          );


      await createNotification({
        audienceRoles: ['admin', 'manager', 'receptionist'],
        type: 'booking',
        title: 'New online reservation',
        message: `Room ${room.number} has a new online reservation for ${guest.name}.`,
        link: '/reservations',
        settingKey: 'newReservation'
      });

      res.status(201).json({

        message:
          'Reservation request confirmed',

        booking:
          populated

      });

    } catch (err) {

      res.status(500).json({
        message:
          err.message
      });

    }
  }
);


// =====================================================
// GUEST: MY BOOKINGS
// =====================================================

router.get(
  '/mine',
  protect,
  requireRole('guest'),
  async (req, res) => {
    try {
      const bookings = await Booking.find({ guest: req.user._id })
        .populate('guest', 'name email phone')
        .populate('room')
        .populate('invoice')
        .sort({ checkIn: -1, createdAt: -1 });

      res.json(bookings);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  '/mine',
  protect,
  requireRole('guest'),
  validateBookingBody,
  async (req, res) => {
    try {
      const { room: roomId, checkIn, checkOut } = req.body;
      const room = await Room.findById(roomId);

      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      if (['maintenance', 'cleaning'].includes(room.status)) {
        return res.status(400).json({
          message: `Room ${room.number} is not currently available`
        });
      }

      const ci = new Date(checkIn);
      const co = new Date(checkOut);
      const overlapping = await findOverlappingBooking(roomId, ci, co);

      if (overlapping) {
        return res.status(409).json({
          message: 'Room is already reserved for the selected dates'
        });
      }

      const booking = await Booking.create({
        guest: req.user._id,
        room: room._id,
        checkIn: ci,
        checkOut: co,
        source: 'online',
        totalPrice: nightsBetween(ci, co) * room.price
      });

      const populated = await Booking.findById(booking._id)
        .populate('guest', 'name email phone')
        .populate('room')
        .populate('invoice');

      await createNotification({
        audienceRoles: ['admin', 'manager', 'receptionist'],
        type: 'booking',
        title: 'New online reservation',
        message: `Room ${room.number} has a new online reservation for ${req.user.name}.`,
        link: '/reservations',
        settingKey: 'newReservation'
      });

      res.status(201).json(populated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


// =====================================================
// LIST BOOKINGS
// =====================================================

router.get(
  '/',
  protect,
  requireRole(staffRoles),

  async (req, res) => {

    try {

      const bookings =
        await Booking
          .find()
          .populate(
            'guest',
            'name email phone'
          )
          .populate(
            'room'
          )
          .populate(
            'invoice'
          )
          .sort({
            checkIn: 1,
            createdAt: -1
          });


      res.json(
        bookings
      );

    } catch (err) {

      res.status(500).json({
        message:
          err.message
      });

    }
  }
);


// =====================================================
// ADD SERVICE TO A BOOKING
// =====================================================

router.post(
  '/:id/services',
  protect,
  requireRole(staffRoles),
  checkObjectId('id'),

  async (req, res) => {
    try {
      const { serviceId = null, name = '', price = null, quantity = 1 } = req.body;
      const qty = Number(quantity);

      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({
          message: 'Service quantity must be a positive whole number'
        });
      }

      let catalogService = null;
      if (serviceId) {
        catalogService = await Service.findById(serviceId);
        if (!catalogService) {
          return res.status(404).json({ message: 'Service not found in the service catalogue' });
        }
      }

      const cleanName = String(catalogService?.name || name || '').trim();
      const unitPrice = Number(catalogService?.price ?? price);

      if (!cleanName) {
        return res.status(400).json({
          message: 'Service name is required'
        });
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          message: 'Service price must be a valid non-negative number'
        });
      }

      const booking = await Booking.findById(req.params.id)
        .populate('guest', 'name email phone')
        .populate('room');

      if (!booking) {
        return res.status(404).json({
          message: 'Booking not found'
        });
      }

      if (bookingServicesLocked(booking)) {
        return res.status(400).json({
          message: 'Services cannot be added to a closed reservation'
        });
      }

      booking.services.push({
        name: cleanName,
        price: unitPrice,
        quantity: qty
      });

      await booking.save();

      res.status(201).json({
        message: 'Service added to reservation',
        booking: await getPopulatedBooking(booking._id)
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


// =====================================================
// UPDATE A SERVICE ON A BOOKING
// =====================================================

router.put(
  '/:id/services/:serviceId',
  protect,
  requireRole(staffRoles),
  checkObjectId('id'),
  checkObjectId('serviceId'),

  async (req, res) => {
    try {
      const qty = Number(req.body.quantity);

      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({
          message: 'Service quantity must be a positive whole number'
        });
      }

      const booking = await Booking.findById(req.params.id);

      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (bookingServicesLocked(booking)) {
        return res.status(400).json({
          message: 'Services cannot be edited on a closed reservation'
        });
      }

      const item = booking.services.id(req.params.serviceId);

      if (!item) {
        return res.status(404).json({
          message: 'Service not found on this reservation'
        });
      }

      item.quantity = qty;
      await booking.save();

      res.json({
        message: 'Service updated',
        booking: await getPopulatedBooking(booking._id)
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


// =====================================================
// REMOVE A SERVICE FROM A BOOKING
// =====================================================

router.delete(
  '/:id/services/:serviceId',
  protect,
  requireRole(staffRoles),
  checkObjectId('id'),
  checkObjectId('serviceId'),

  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);

      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (bookingServicesLocked(booking)) {
        return res.status(400).json({
          message: 'Services cannot be removed from a closed reservation'
        });
      }

      const item = booking.services.id(req.params.serviceId);

      if (!item) {
        return res.status(404).json({
          message: 'Service not found on this reservation'
        });
      }

      booking.services.pull(req.params.serviceId);
      await booking.save();

      res.json({
        message: 'Service removed from reservation',
        booking: await getPopulatedBooking(booking._id)
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


// =====================================================
// GET SINGLE BOOKING
// =====================================================

router.get(
  '/:id',
  protect,
  checkObjectId('id'),

  async (req, res) => {

    try {

      const booking =
        await Booking
          .findById(
            req.params.id
          )
          .populate(
            'guest',
            'name email phone'
          )
          .populate(
            'room'
          )
          .populate(
            'invoice'
          );


      if (!booking) {
        return res.status(404).json({
          message:
            'Booking not found'
        });
      }


      if (
        req.user.role === 'guest' &&
        booking.guest._id.toString() !==
        req.user._id.toString()
      ) {
        return res.status(403).json({
          message:
            'Forbidden'
        });
      }


      res.json(
        booking
      );

    } catch (err) {

      res.status(500).json({
        message:
          err.message
      });

    }
  }
);


// =====================================================
// CHECK-IN
// Automatically:
// 1. Changes booking status
// 2. Occupies room
// 3. Issues key
// 4. Generates key code
// =====================================================

router.patch(
  '/:id/check-in',
  protect,
  requireRole(staffRoles),
  checkObjectId('id'),

  async (req, res) => {

    try {

      const booking =
        await Booking
          .findById(
            req.params.id
          )
          .populate(
            'room'
          );


      if (!booking) {
        return res.status(404).json({
          message:
            'Booking not found'
        });
      }


      if (
        booking.status !==
        'reserved'
      ) {
        return res.status(400).json({
          message:
            `Booking is already ${booking.status}`
        });
      }


      if (
        [
          'maintenance',
          'cleaning'
        ].includes(
          booking.room.status
        )
      ) {
        return res.status(400).json({
          message:
            `Room ${booking.room.number} is currently ${booking.room.status}`
        });
      }


      const conflicting =
        await findOverlappingBooking(
          booking.room._id,
          booking.checkIn,
          booking.checkOut,
          booking._id
        );


      if (conflicting) {
        return res.status(409).json({
          message:
            'Room has another active reservation'
        });
      }


      booking.status =
        'checked-in';

      booking.checkedInAt =
        new Date();

      booking.keyIssued =
        true;

      booking.keyCode =
        booking.keyCode ||
        createKeyCode();


      booking.room.status =
        'occupied';


      await booking.room.save();

      await booking.save();


      const updated =
        await Booking
          .findById(
            booking._id
          )
          .populate(
            'guest',
            'name email phone'
          )
          .populate(
            'room'
          )
          .populate(
            'invoice'
          );


      res.json({

        message:
          `Check-in completed. Key ${updated.keyCode} issued.`,

        booking:
          updated

      });

    } catch (err) {

      res.status(500).json({
        message:
          err.message
      });

    }
  }
);


// =====================================================
// CHECK-OUT
// Automatically:
// 1. Changes booking status
// 2. Marks room cleaning
// 3. Generates invoice
// =====================================================

router.patch(
  '/:id/check-out',
  protect,
  requireRole(staffRoles),
  checkObjectId('id'),

  async (req, res) => {

    try {

      const booking =
        await Booking
          .findById(
            req.params.id
          )
          .populate(
            'room'
          );


      if (!booking) {
        return res.status(404).json({
          message:
            'Booking not found'
        });
      }


      if (
        booking.status !==
        'checked-in'
      ) {
        return res.status(400).json({
          message:
            'Only checked-in reservations can be checked out'
        });
      }


      booking.status =
        'checked-out';

      booking.checkedOutAt =
        new Date();


      booking.room.status =
        'cleaning';


      await booking.room.save();

      await booking.save();


      const invoice =
        await createInvoiceForBooking(
          booking
        );


      const updated =
        await Booking
          .findById(
            booking._id
          )
          .populate(
            'guest',
            'name email phone'
          )
          .populate(
            'room'
          )
          .populate(
            'invoice'
          );


      res.json({

        message:
          `Check-out completed. Invoice ${invoice._id.toString().slice(-6).toUpperCase()} generated.`,

        booking:
          updated,

        invoice

      });

    } catch (err) {

      res.status(500).json({
        message:
          err.message
      });

    }
  }
);


// =====================================================
// CANCEL RESERVATION
// =====================================================

router.patch(
  '/:id/cancel',
  protect,
  requireRole(staffRoles),
  checkObjectId('id'),

  async (req, res) => {

    try {

      const booking =
        await Booking.findById(
          req.params.id
        );


      if (!booking) {
        return res.status(404).json({
          message:
            'Booking not found'
        });
      }


      if (
        booking.status ===
        'checked-out'
      ) {
        return res.status(400).json({
          message:
            'Checked-out reservations cannot be cancelled'
        });
      }


      if (
        booking.status ===
        'checked-in'
      ) {
        return res.status(400).json({
          message:
            'Check out the guest before closing this reservation'
        });
      }


      booking.status =
        'cancelled';

      await booking.save();


      const updated =
        await Booking
          .findById(
            booking._id
          )
          .populate(
            'guest',
            'name email phone'
          )
          .populate(
            'room'
          );


      res.json({

        message:
          'Reservation cancelled',

        booking:
          updated

      });

    } catch (err) {

      res.status(500).json({
        message:
          err.message
      });

    }
  }
);


module.exports = router;