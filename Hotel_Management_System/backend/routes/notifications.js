const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { checkObjectId } = require('../middleware/validators');

router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    const notifications = await Notification.find({
      $or: [
        { recipient: req.user._id },
        { audienceRoles: req.user.role }
      ]
    }).sort({ createdAt: -1 }).limit(limit);
    res.json(notifications);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.patch('/:id/read', protect, checkObjectId('id'), async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, $or: [{ recipient: req.user._id }, { audienceRoles: req.user.role }] },
      { readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { $or: [{ recipient: req.user._id }, { audienceRoles: req.user.role }], readAt: null },
      { readAt: new Date() }
    );
    res.json({ message: 'Notifications marked as read' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
