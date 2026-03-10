const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');

// POST /api/promos/validate
router.post('/validate', protect, async (req, res) => {
  try {
    const { code, fare } = req.body;
    if (!code) return res.status(400).json({ message: 'Enter a promo code' });

    const promo = await db.promoCodes.findOneAsync({ code: code.toUpperCase(), isActive: true });
    if (!promo) return res.status(404).json({ message: 'Invalid promo code' });

    if (new Date() > new Date(promo.expiresAt))
      return res.status(400).json({ message: 'Promo code has expired' });

    if (promo.usedCount >= promo.usageLimit)
      return res.status(400).json({ message: 'Promo code usage limit reached' });

    if (fare < promo.minFare)
      return res.status(400).json({ message: `Minimum fare of ₹${promo.minFare} required` });

    // Check if user already used this promo
    const user = await db.users.findOneAsync({ _id: req.user._id });
    if (user.usedPromoCodes?.includes(code.toUpperCase()))
      return res.status(400).json({ message: 'You have already used this promo code' });

    // Calculate discount
    let discount = 0;
    if (promo.type === 'flat') {
      discount = Math.min(promo.value, promo.maxDiscount);
    } else if (promo.type === 'percentage') {
      discount = Math.min(Math.round((fare * promo.value) / 100), promo.maxDiscount);
    }

    const finalFare = Math.max(fare - discount, 10); // minimum ₹10

    res.json({
      valid: true,
      code: promo.code,
      discount,
      finalFare,
      description: promo.description,
      type: promo.type,
      value: promo.value,
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// GET /api/promos/available - list active promos
router.get('/available', protect, async (req, res) => {
  try {
    const promos = await db.promoCodes.findAsync({ isActive: true, expiresAt: { $gt: new Date() } });
    const user = await db.users.findOneAsync({ _id: req.user._id });
    const withStatus = promos.map(p => ({
      ...p,
      alreadyUsed: user.usedPromoCodes?.includes(p.code) || false,
      limitReached: p.usedCount >= p.usageLimit,
    }));
    res.json(withStatus);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
