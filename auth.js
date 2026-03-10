const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

const JWT_SECRET = process.env.JWT_SECRET || 'uber-jaipur-secret';
const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
const safeUser = (user) => { const u = { ...user }; delete u.password; return u; };

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, vehicleDetails } = req.body;
    if (!name || !email || !phone || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const existingEmail = await db.users.findOneAsync({ email: email.toLowerCase() });
    if (existingEmail) return res.status(400).json({ message: 'Email already registered' });

    const existingPhone = await db.users.findOneAsync({ phone });
    if (existingPhone) return res.status(400).json({ message: 'Phone already registered' });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await db.users.insertAsync({
      name, email: email.toLowerCase(), phone,
      password: hashedPassword,
      role: role || 'rider',
      isDriver: role === 'driver',
      isAvailable: false,
      vehicleDetails: role === 'driver' && vehicleDetails ? vehicleDetails : {},
      rating: 5.0, totalRides: 0, earnings: 0,
      walletBalance: role === 'rider' ? 200 : 0, // ₹200 welcome bonus for riders
      socketId: '',
      currentLocation: { lat: 26.9124, lng: 75.7873, address: 'Jaipur' },
      usedPromoCodes: [],
      createdAt: new Date(),
    });

    // Welcome notification
    await createNotification(user._id, {
      type: 'welcome',
      title: '🎉 Welcome to Uber Jaipur!',
      message: role === 'rider'
        ? 'Your account is ready! You got ₹200 welcome bonus in your wallet.'
        : 'Your driver account is ready! Go online to start accepting rides.',
      icon: '🚕',
    });

    // Wallet credit notification for riders
    if (role !== 'driver') {
      await createNotification(user._id, {
        type: 'wallet_credit',
        title: '💰 Wallet Credited!',
        message: '₹200 welcome bonus added to your wallet.',
        icon: '💰',
        amount: 200,
      });
    }

    res.status(201).json({ ...safeUser(user), token: generateToken(user._id) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });
    const user = await db.users.findOneAsync({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });
    res.json({ ...safeUser(user), token: generateToken(user._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  const user = await db.users.findOneAsync({ _id: req.user._id });
  res.json(safeUser(user));
});

// PUT /api/auth/update-location
router.put('/update-location', protect, async (req, res) => {
  try {
    const { lat, lng, address } = req.body;
    await db.users.updateAsync({ _id: req.user._id }, { $set: { currentLocation: { lat, lng, address: address || '' } } });
    res.json({ message: 'Location updated' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// PUT /api/auth/toggle-availability
router.put('/toggle-availability', protect, async (req, res) => {
  try {
    const user = await db.users.findOneAsync({ _id: req.user._id });
    const newStatus = !user.isAvailable;
    await db.users.updateAsync({ _id: req.user._id }, { $set: { isAvailable: newStatus } });
    res.json({ isAvailable: newStatus });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
