const express = require('express');
const router = express.Router();

const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const Room = require('../models/Room');
const Feedback = require('../models/Feedback');
const { protect, requireRole } = require('../middleware/auth');

const MANAGEMENT_ROLES = ['admin', 'manager'];
const DAY_MS = 1000 * 60 * 60 * 24;

function dateOnly(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function parseRange(req) {
  const now = new Date();
  const defaultTo = dateOnly(now);
  const defaultFrom = new Date(defaultTo.getTime() - 29 * DAY_MS);

  const from = req.query.from ? dateOnly(req.query.from) : defaultFrom;
  const to = req.query.to ? dateOnly(req.query.to) : defaultTo;
  to.setHours(23, 59, 59, 999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return null;
  }

  return { from, to };
}

function nightsBetween(checkIn, checkOut) {
  return Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / DAY_MS));
}

function overlapNights(checkIn, checkOut, from, to) {
  const start = Math.max(new Date(checkIn).getTime(), from.getTime());
  const end = Math.min(new Date(checkOut).getTime(), to.getTime() + 1);
  return Math.max(0, Math.ceil((end - start) / DAY_MS));
}

async function buildDashboard(range) {
  const { from, to } = range;
  const totalRooms = await Room.countDocuments();

  const bookings = await Booking.find({
    status: { $in: ['reserved', 'checked-in', 'checked-out'] },
    checkIn: { $lt: to },
    checkOut: { $gt: from }
  }).populate('room', 'number type price');

  const invoices = await Invoice.find({
    issuedAt: { $gte: from, $lte: to }
  });

  const feedback = await Feedback.find({
    createdAt: { $gte: from, $lte: to }
  });

  const periodDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1);
  const availableRoomNights = totalRooms * periodDays;

  let soldRoomNights = 0;
  let roomRevenue = 0;
  const serviceMap = new Map();

  for (const booking of bookings) {
    const nights = overlapNights(booking.checkIn, booking.checkOut, from, to);
    if (!nights) continue;

    soldRoomNights += nights;
    const roomPrice = Number(booking.room?.price || 0);
    roomRevenue += nights * roomPrice;

    for (const service of booking.services || []) {
      const quantity = Math.max(1, Number(service.quantity || 1));
      const amount = Number(service.price || 0) * quantity;
      const key = service.name || 'Other service';
      serviceMap.set(key, (serviceMap.get(key) || 0) + amount);
    }
  }

  const invoiceRevenue = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const occupancyRate = availableRoomNights ? (soldRoomNights / availableRoomNights) * 100 : 0;
  const adr = soldRoomNights ? roomRevenue / soldRoomNights : 0;
  const avgRating = feedback.length
    ? feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedback.length
    : 0;

  const servicePerformance = [...serviceMap.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Demand forecast: simple, explainable 3-month moving average of historical bookings.
  const monthBuckets = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= endMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    monthBuckets.push({ month: key, bookings: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const booking of bookings) {
    const date = new Date(booking.checkIn);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthBuckets.find((item) => item.month === key);
    if (bucket) bucket.bookings += 1;
  }

  const recent = monthBuckets.slice(-3).map((item) => item.bookings);
  const forecastBookings = recent.length
    ? Math.round(recent.reduce((sum, value) => sum + value, 0) / recent.length)
    : 0;

  let pricingAction = 'Hold rates';
  let pricingMultiplier = 1;
  if (occupancyRate >= 80) {
    pricingAction = 'Increase rates 10%';
    pricingMultiplier = 1.10;
  } else if (occupancyRate >= 65) {
    pricingAction = 'Increase rates 5%';
    pricingMultiplier = 1.05;
  } else if (occupancyRate < 40) {
    pricingAction = 'Consider a 10% promotional reduction';
    pricingMultiplier = 0.90;
  }

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString()
    },
    occupancy: {
      totalRooms,
      periodDays,
      availableRoomNights,
      soldRoomNights,
      occupancyRate: Number(occupancyRate.toFixed(2))
    },
    revenue: {
      totalRevenue: Number(invoiceRevenue.toFixed(2)),
      roomRevenue: Number(roomRevenue.toFixed(2)),
      adr: Number(adr.toFixed(2)),
      invoiceCount: invoices.length
    },
    feedback: {
      count: feedback.length,
      averageRating: Number(avgRating.toFixed(2)),
      fiveStarPercent: feedback.length
        ? Number((feedback.filter((item) => Number(item.rating) === 5).length / feedback.length * 100).toFixed(1))
        : 0
    },
    servicePerformance,
    demandForecast: {
      historical: monthBuckets,
      nextMonthBookings: forecastBookings,
      method: 'Three-month moving average of booking volume'
    },
    pricingRecommendation: {
      action: pricingAction,
      multiplier: pricingMultiplier,
      basedOnOccupancy: Number(occupancyRate.toFixed(2))
    }
  };
}

router.get('/dashboard', protect, requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const range = parseRange(req);
    if (!range) return res.status(400).json({ message: 'Invalid report date range' });
    res.json(await buildDashboard(range));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/occupancy', protect, requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const range = parseRange(req);
    if (!range) return res.status(400).json({ message: 'Invalid report date range' });
    const dashboard = await buildDashboard(range);
    res.json(dashboard.occupancy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/revenue', protect, requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const range = parseRange(req);
    if (!range) return res.status(400).json({ message: 'Invalid report date range' });
    const dashboard = await buildDashboard(range);
    res.json(dashboard.revenue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/feedback', protect, requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const range = parseRange(req);
    if (!range) return res.status(400).json({ message: 'Invalid report date range' });
    const feedback = await Feedback.find({ createdAt: { $gte: range.from, $lte: range.to } })
      .populate('guest', 'name email')
      .sort({ createdAt: -1 });
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analytics', protect, requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const range = parseRange(req);
    if (!range) return res.status(400).json({ message: 'Invalid report date range' });
    const dashboard = await buildDashboard(range);
    res.json({
      demandForecast: dashboard.demandForecast,
      pricingRecommendation: dashboard.pricingRecommendation,
      servicePerformance: dashboard.servicePerformance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
