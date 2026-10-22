const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const Room = require('../models/Room');
const { protect, requireRole } = require('../middleware/auth');

const ADMIN = ['admin'];

const DEFAULT_SETTINGS = {
  key: 'hotel',
  propertyName: 'LuxuryStay Hospitality',
  propertyCode: 'LSH-001',
  contactEmail: 'frontdesk@luxurystay.com',
  phone: '',
  address: '',
  currency: 'USD',
  taxRate: 12,
  defaultCheckIn: '14:00',
  defaultCheckOut: '12:00',
  roomRates: [],
  policies: {},
  notifications: {},
  security: {}
};

async function getOrCreateSettings() {
  let settings = await Settings.findOne({ key: 'hotel' });
  if (!settings) settings = await Settings.create(DEFAULT_SETTINGS);
  return settings;
}

router.get('/', protect, requireRole(ADMIN), async (req, res) => {
  try { res.json(await getOrCreateSettings()); }
  catch (error) { res.status(500).json({ message: error.message }); }
});

router.put('/', protect, requireRole(ADMIN), async (req, res) => {
  try {
    const current = await getOrCreateSettings();
    const allowed = [
      'propertyName', 'propertyCode', 'contactEmail', 'phone', 'address',
      'currency', 'taxRate', 'defaultCheckIn', 'defaultCheckOut',
      'roomRates', 'policies', 'notifications', 'security'
    ];

    for (const field of allowed) {
      if (req.body[field] !== undefined) current[field] = req.body[field];
    }

    if (!['USD', 'PKR', 'EUR', 'GBP'].includes(current.currency)) return res.status(400).json({ message: 'Invalid currency' });
    if (!Number.isFinite(Number(current.taxRate)) || Number(current.taxRate) < 0 || Number(current.taxRate) > 100) return res.status(400).json({ message: 'Tax rate must be between 0 and 100' });
    if (!Array.isArray(current.roomRates)) return res.status(400).json({ message: 'Room rates must be an array' });

    current.taxRate = Number(current.taxRate);
    current.roomRates = current.roomRates
      .filter((item) => item && String(item.type || '').trim() && Number.isFinite(Number(item.rate)) && Number(item.rate) >= 0)
      .map((item) => ({ type: String(item.type).trim(), rate: Number(item.rate) }));

    await current.save();
    res.json(current);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/apply-room-rates', protect, requireRole(ADMIN), async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    let updated = 0;
    for (const rate of settings.roomRates) {
      const result = await Room.updateMany({ type: rate.type }, { $set: { price: rate.rate } });
      updated += result.modifiedCount || 0;
    }
    res.json({ message: `${updated} room rate(s) updated from system settings`, updated });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
