const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { protect, requireRole } = require('../middleware/auth');
const { validateServiceBody, checkObjectId } = require('../middleware/validators');

// Create service (admin/manager)
router.post('/', protect, requireRole(['admin', 'manager']), validateServiceBody, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const existing = await Service.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });

    if (existing) {
      return res.status(400).json({ message: 'A service with this name already exists. Reuse the existing service for any guest.' });
    }

    const svc = new Service({
      ...req.body,
      name
    });
    await svc.save();
    res.status(201).json(svc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List services
router.get('/', protect, async (req, res) => {
  const services = await Service.find();
  res.json(services);
});

// Update service
router.put('/:id', protect, requireRole(['admin', 'manager']), checkObjectId('id'), validateServiceBody, async (req, res) => {
  const svc = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(svc);
});

// Delete service
router.delete('/:id', protect, requireRole(['admin', 'manager']), checkObjectId('id'), async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.json({ message: 'Service deleted' });
});

module.exports = router;
