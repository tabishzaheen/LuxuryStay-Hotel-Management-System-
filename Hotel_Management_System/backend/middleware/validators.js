const mongoose = require('mongoose');

exports.checkObjectId = (param = 'id') => (req, res, next) => {
  const value = req.params[param];
  if (value && !mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: `Invalid ${param}` });
  }
  next();
};

exports.requireFields = (fields = []) => (req, res, next) => {
  const missing = fields.filter((field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === '');
  if (missing.length > 0) {
    return res.status(400).json({ message: 'Required fields are missing', fields: missing });
  }
  next();
};

exports.validateRoomBody = (req, res, next) => {
  const { number, type, price, status, amenities } = req.body;

  if (!number || !String(number).trim()) {
    return res.status(400).json({ message: 'Room number is required' });
  }

  if (!type || !String(type).trim()) {
    return res.status(400).json({ message: 'Room type is required' });
  }

  if (price === undefined || price === null || price === '' || Number.isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ message: 'Room price must be a valid positive number' });
  }

  const allowedStatuses = ['available', 'occupied', 'cleaning', 'maintenance'];
  if (status !== undefined && !allowedStatuses.includes(String(status).toLowerCase())) {
    return res.status(400).json({ message: 'Invalid room status. Allowed values: available, occupied, cleaning, maintenance' });
  }

  if (amenities !== undefined && !Array.isArray(amenities)) {
    return res.status(400).json({ message: 'Amenities must be an array' });
  }

  next();
};

exports.validateBookingBody = (req, res, next) => {
  const { room, guest, checkIn, checkOut } = req.body;

  if (!room) return res.status(400).json({ message: 'Room is required' });
  if (!mongoose.Types.ObjectId.isValid(room)) return res.status(400).json({ message: 'Invalid room id' });
  if (guest && !mongoose.Types.ObjectId.isValid(guest)) return res.status(400).json({ message: 'Invalid guest id' });
  if (!checkIn || !checkOut) return res.status(400).json({ message: 'Check-in and check-out dates are required' });

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    return res.status(400).json({ message: 'Invalid check-in or check-out date' });
  }
  if (checkInDate >= checkOutDate) {
    return res.status(400).json({ message: 'Check-out date must be after check-in date' });
  }

  next();
};

exports.validateBookingStatus = (req, res, next) => {
  const allowedStatuses = ['reserved', 'checked-in', 'checked-out', 'cancelled'];
  if (!allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({ message: 'Invalid booking status. Allowed values: reserved, checked-in, checked-out, cancelled' });
  }
  next();
};

exports.validateServiceBody = (req, res, next) => {
  const { name, price } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ message: 'Service name is required' });
  if (price === undefined || price === null || price === '' || Number.isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ message: 'Service price must be a valid positive number' });
  }
  next();
};

exports.validateInvoiceBody = (req, res, next) => {
  const { bookingId, items = [], taxRate = 0 } = req.body;

  if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });
  if (!mongoose.Types.ObjectId.isValid(bookingId)) return res.status(400).json({ message: 'Invalid bookingId' });
  if (!Array.isArray(items)) return res.status(400).json({ message: 'Invoice items must be an array' });
  if (Number.isNaN(Number(taxRate)) || Number(taxRate) < 0) return res.status(400).json({ message: 'Invalid tax rate' });

  next();
};
