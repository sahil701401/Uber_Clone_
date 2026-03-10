const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');

// GET /api/notifications
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await db.notifications
      .findAsync({ userId: req.user._id })
      .sort({ createdAt: -1 });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', protect, async (req, res) => {
  try {
    await db.notifications.updateAsync(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true } },
      { multi: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', protect, async (req, res) => {
  try {
    await db.notifications.updateAsync({ _id: req.params.id }, { $set: { isRead: true } });
    res.json({ message: 'Notification marked as read' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// DELETE /api/notifications/clear
router.delete('/clear', protect, async (req, res) => {
  try {
    await db.notifications.removeAsync({ userId: req.user._id }, { multi: true });
    res.json({ message: 'All notifications cleared' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
