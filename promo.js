const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');

// Seed some default promo codes on first run
async function seedPromoCodes() {
  const count = await db.promoCodes.countAsync({});
  if (count === 0) {
    await db.promoCodes.insertAsync([
      {
        code: 'WELCOME50',
        description: '50% off your first ride!',
        discountType: 'percentage',
        discountValue: 50,
        maxDiscount: 100,
        minRideAmount: 50,
        maxUses: 1000,
        usedCount: 0,
        usedBy: [],
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        code: 'JAIPUR30',
        description: '₹30 off on rides above ₹100',
        discountType: 'flat',
        discountValue: 30,
        maxDiscount: 30,
        minRideAmount: 100,
        maxUses: 500,
        usedCount: 0,
        usedBy: [],
        isActive: true,
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        code: 'PINKCITY',
        description: '₹50 flat off - no minimum!',
        discountType: 'flat',
        discountValue: 50,
        maxDiscount: 50,
        minRideAmount: 0,
        maxUses: 200,
        usedCount: 0,
        usedBy: [],
        isActive: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        code: 'RIDE25',
        description: '25% off, max ₹75 discount',
        discountType: 'percentage',
        discountValue: 25,
        maxDiscount: 75,
        minRideAmount: 80,
        maxUses: 1000,
        usedCount: 0,
        usedBy: [],
        isActive: true,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
    ]);
    console.log('🎟️ Default promo codes seeded!');
  }
}
seedPromoCodes();

// POST /api/promo/validate - Validate a promo code
router.post('/validate', protect, async (req, res) => {
  try {
    const { code, rideAmount } = req.body;
    if (!code) return res.status(400).json({ message: 'Enter a promo code' });

    const promo = await db.promoCodes.findOneAsync({ code: code.toUpperCase() });
    if (!promo) return res.status(404).json({ message: 'Invalid promo code' });
    if (!promo.isActive) return res.status(400).json({ message: 'This promo code is no longer active' });
    if (new Date() > new Date(promo.expiresAt)) return res.status(400).json({ message: 'This promo code has expired' });
    if (promo.usedCount >= promo.maxUses) return res.status(400).json({ message: 'Promo code usage limit reached' });
    if (promo.usedBy.includes(req.user._id)) return res.status(400).json({ message: 'You have already used this promo code' });
    if (rideAmount < promo.minRideAmount) {
      return res.status(400).json({ message: `Minimum ride amount of ₹${promo.minRideAmount} required` });
    }

    let discount = 0;
    if (promo.discountType === 'percentage') {
      discount = Math.round((rideAmount * promo.discountValue) / 100);
      discount = Math.min(discount, promo.maxDiscount);
    } else {
      discount = promo.discountValue;
    }

    const finalAmount = Math.max(rideAmount - discount, 10); // Minimum ₹10

    res.json({
      valid: true,
      code: promo.code,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discount,
      originalAmount: rideAmount,
      finalAmount,
      message: `🎉 Promo applied! You save ₹${discount}`,
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// POST /api/promo/apply - Apply promo to a ride (mark as used)
router.post('/apply', protect, async (req, res) => {
  try {
    const { code, rideId } = req.body;
    const promo = await db.promoCodes.findOneAsync({ code: code.toUpperCase() });
    if (!promo) return res.status(404).json({ message: 'Invalid promo code' });
    if (promo.usedBy.includes(req.user._id)) return res.status(400).json({ message: 'Already used' });

    await db.promoCodes.updateAsync(
      { _id: promo._id },
      { $inc: { usedCount: 1 }, $push: { usedBy: req.user._id } }
    );

    if (rideId) {
      await db.rides.updateAsync({ _id: rideId }, { $set: { promoCode: code.toUpperCase() } });
    }

    res.json({ success: true, message: 'Promo code applied!' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// GET /api/promo/available - List available promos for user
router.get('/available', protect, async (req, res) => {
  try {
    const now = new Date();
    const promos = await db.promoCodes.findAsync({ isActive: true });
    const available = promos.filter(p =>
      new Date(p.expiresAt) > now &&
      p.usedCount < p.maxUses &&
      !p.usedBy.includes(req.user._id)
    );
    // Don't expose usedBy array
    const safe = available.map(({ usedBy, ...p }) => p);
    res.json(safe);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// POST /api/promo/create - Create a new promo code (admin-like)
router.post('/create', protect, async (req, res) => {
  try {
    const { code, description, discountType, discountValue, maxDiscount, minRideAmount, maxUses, expiryDays } = req.body;
    if (!code || !discountType || !discountValue)
      return res.status(400).json({ message: 'Code, type and value are required' });

    const existing = await db.promoCodes.findOneAsync({ code: code.toUpperCase() });
    if (existing) return res.status(400).json({ message: 'Promo code already exists' });

    const promo = await db.promoCodes.insertAsync({
      code: code.toUpperCase(),
      description: description || '',
      discountType,
      discountValue: Number(discountValue),
      maxDiscount: Number(maxDiscount) || Number(discountValue),
      minRideAmount: Number(minRideAmount) || 0,
      maxUses: Number(maxUses) || 100,
      usedCount: 0,
      usedBy: [],
      isActive: true,
      expiresAt: new Date(Date.now() + (Number(expiryDays) || 30) * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const { usedBy, ...safePromo } = promo;
    res.status(201).json(safePromo);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
