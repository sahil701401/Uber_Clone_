const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

const FARE_RATES = {
  auto:  { base: 30, perKm: 12, perMin: 1.5 },
  mini:  { base: 50, perKm: 14, perMin: 2 },
  sedan: { base: 80, perKm: 18, perMin: 2.5 },
  suv:   { base: 100, perKm: 22, perMin: 3 },
};

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcFare(distance, duration, rideType) {
  const r = FARE_RATES[rideType] || FARE_RATES.mini;
  return Math.round(r.base + distance * r.perKm + duration * r.perMin);
}

function generateOTP() { return Math.floor(1000 + Math.random() * 9000).toString(); }

async function populateRide(ride) {
  if (!ride) return null;
  const p = { ...ride };
  if (ride.riderId) { const u = await db.users.findOneAsync({ _id: ride.riderId }); if (u) { delete u.password; p.rider = u; } }
  if (ride.driverId) { const u = await db.users.findOneAsync({ _id: ride.driverId }); if (u) { delete u.password; p.driver = u; } }
  return p;
}

// POST /api/rides/estimate
router.post('/estimate', protect, async (req, res) => {
  try {
    const { pickup, destination } = req.body;
    const dist = calcDistance(pickup.coordinates.lat, pickup.coordinates.lng, destination.coordinates.lat, destination.coordinates.lng);
    const dur = Math.round((dist / 25) * 60);
    const estimates = {};
    for (const t of ['auto','mini','sedan','suv']) estimates[t] = { fare: calcFare(dist, dur, t), distance: dist.toFixed(2), duration: dur, currency: 'INR' };
    res.json({ estimates, distance: dist.toFixed(2), duration: dur });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/rides/book
router.post('/book', protect, async (req, res) => {
  try {
    const { pickup, destination, rideType, paymentMethod, promoCode, discountAmount } = req.body;

    const activeRide = await db.rides.findOneAsync({ riderId: req.user._id, status: { $in: ['requested','accepted','driver_arriving','in_progress'] } });
    if (activeRide) return res.status(400).json({ message: 'You already have an active ride' });

    const dist = calcDistance(pickup.coordinates.lat, pickup.coordinates.lng, destination.coordinates.lat, destination.coordinates.lng);
    const dur = Math.round((dist / 25) * 60);
    const baseFare = calcFare(dist, dur, rideType || 'mini');
    const discount = discountAmount || 0;
    const finalFare = Math.max(baseFare - discount, 10);

    // Validate wallet payment
    if (paymentMethod === 'wallet') {
      const user = await db.users.findOneAsync({ _id: req.user._id });
      if ((user.walletBalance || 0) < finalFare) {
        return res.status(400).json({ message: `Insufficient wallet balance. You have ₹${user.walletBalance || 0}` });
      }
    }

    // Validate & apply promo code
    if (promoCode) {
      const promo = await db.promoCodes.findOneAsync({ code: promoCode.toUpperCase(), isActive: true });
      if (promo) {
        await db.promoCodes.updateAsync({ _id: promo._id }, { $inc: { usedCount: 1 } });
        const user = await db.users.findOneAsync({ _id: req.user._id });
        const usedCodes = user.usedPromoCodes || [];
        await db.users.updateAsync({ _id: req.user._id }, { $set: { usedPromoCodes: [...usedCodes, promoCode.toUpperCase()] } });
      }
    }

    const ride = await db.rides.insertAsync({
      riderId: req.user._id, driverId: null,
      pickup, destination,
      rideType: rideType || 'mini',
      status: 'requested',
      fare: { estimated: baseFare, discount, finalFare, actual: 0, currency: 'INR' },
      promoCode: promoCode || null,
      distance: dist, duration: dur,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'pending',
      otp: generateOTP(),
      rating: { riderRating: null, driverRating: null },
      cancelReason: '', cancelledBy: null,
      startTime: null, endTime: null,
      createdAt: new Date(),
    });

    await createNotification(req.user._id, {
      type: 'ride_requested', rideId: ride._id,
      title: '🔍 Looking for drivers...',
      message: `Searching for a ${rideType || 'mini'} near you. Estimated fare: ₹${finalFare}`,
      icon: '🔍',
    });

    const io = req.app.get('io');
    if (io) {
      const drivers = await db.users.findAsync({ role: 'driver', isAvailable: true, 'vehicleDetails.type': rideType || 'mini' });
      drivers.forEach(d => {
        if (d.socketId) {
          io.to(d.socketId).emit('new_ride_request', {
            rideId: ride._id, pickup: ride.pickup, destination: ride.destination,
            fare: finalFare, distance: dist, duration: dur,
            rider: { name: req.user.name, rating: req.user.rating }, rideType: ride.rideType,
          });
        }
      });
    }

    res.status(201).json(await populateRide(ride));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT /api/rides/:id/accept
router.put('/:id/accept', protect, async (req, res) => {
  try {
    const ride = await db.rides.findOneAsync({ _id: req.params.id });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status !== 'requested') return res.status(400).json({ message: 'Ride no longer available' });

    await db.rides.updateAsync({ _id: req.params.id }, { $set: { driverId: req.user._id, status: 'accepted' } });
    await db.users.updateAsync({ _id: req.user._id }, { $set: { isAvailable: false } });

    const updatedRide = await db.rides.findOneAsync({ _id: req.params.id });
    const populated = await populateRide(updatedRide);

    // Notify rider
    await createNotification(ride.riderId, {
      type: 'ride_accepted', rideId: ride._id,
      title: '🚕 Driver is on the way!',
      message: `${req.user.name} accepted your ride. ${req.user.vehicleDetails?.color} ${req.user.vehicleDetails?.model} (${req.user.vehicleDetails?.plateNumber})`,
      icon: '🚕',
    });

    const io = req.app.get('io');
    if (io) {
      const rider = await db.users.findOneAsync({ _id: ride.riderId });
      if (rider?.socketId) {
        io.to(rider.socketId).emit('ride_accepted', {
          rideId: ride._id,
          driver: { name: req.user.name, phone: req.user.phone, rating: req.user.rating, vehicleDetails: req.user.vehicleDetails, location: req.user.currentLocation },
          otp: updatedRide.otp,
        });
      }
    }
    res.json(populated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT /api/rides/:id/start
router.put('/:id/start', protect, async (req, res) => {
  try {
    const { otp } = req.body;
    const ride = await db.rides.findOneAsync({ _id: req.params.id });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });

    await db.rides.updateAsync({ _id: req.params.id }, { $set: { status: 'in_progress', startTime: new Date() } });

    await createNotification(ride.riderId, {
      type: 'ride_started', rideId: ride._id,
      title: '🛣️ Ride Started!',
      message: 'Your ride is in progress. Sit back and enjoy!',
      icon: '🛣️',
    });

    const io = req.app.get('io');
    if (io) {
      const rider = await db.users.findOneAsync({ _id: ride.riderId });
      if (rider?.socketId) io.to(rider.socketId).emit('ride_started', { rideId: ride._id });
    }
    res.json(await populateRide(await db.rides.findOneAsync({ _id: req.params.id })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT /api/rides/:id/complete
router.put('/:id/complete', protect, async (req, res) => {
  try {
    const ride = await db.rides.findOneAsync({ _id: req.params.id });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    const actualDur = ride.startTime ? Math.round((new Date() - new Date(ride.startTime)) / 60000) : ride.duration;
    const baseFare = calcFare(ride.distance, actualDur, ride.rideType);
    const discount = ride.fare?.discount || 0;
    const actualFare = Math.max(baseFare - discount, 10);

    await db.rides.updateAsync({ _id: req.params.id }, {
      $set: { status: 'completed', endTime: new Date(), 'fare.actual': actualFare, paymentStatus: ride.paymentMethod === 'wallet' ? 'paid' : 'pending' }
    });

    // Deduct wallet if wallet payment
    if (ride.paymentMethod === 'wallet') {
      const rider = await db.users.findOneAsync({ _id: ride.riderId });
      const newBal = Math.max((rider.walletBalance || 0) - actualFare, 0);
      await db.users.updateAsync({ _id: ride.riderId }, { $set: { walletBalance: newBal } });
      await db.transactions.insertAsync({
        userId: ride.riderId, type: 'debit', amount: actualFare,
        description: `Ride payment - ${ride.rideType}`, method: 'wallet',
        status: 'success', balanceAfter: newBal, rideId: ride._id, createdAt: new Date(),
      });
      await createNotification(ride.riderId, {
        type: 'wallet_debit', rideId: ride._id,
        title: '💳 Ride Payment Deducted',
        message: `₹${actualFare} deducted from wallet. New balance: ₹${newBal}`,
        icon: '💳', amount: actualFare,
      });
    }

    // Update driver
    if (ride.driverId) {
      const driver = await db.users.findOneAsync({ _id: ride.driverId });
      await db.users.updateAsync({ _id: ride.driverId }, {
        $set: { isAvailable: true, earnings: (driver.earnings || 0) + actualFare, totalRides: (driver.totalRides || 0) + 1 }
      });
      await db.transactions.insertAsync({
        userId: ride.driverId, type: 'credit', amount: actualFare,
        description: `Ride earnings - ${ride.rideType}`, method: 'cash',
        status: 'success', balanceAfter: null, rideId: ride._id, createdAt: new Date(),
      });
      await createNotification(ride.driverId, {
        type: 'ride_earning', rideId: ride._id,
        title: '💰 Ride Completed!',
        message: `You earned ₹${actualFare} for this trip. Total earnings updated.`,
        icon: '💰', amount: actualFare,
      });
    }

    // Update rider stats
    if (ride.riderId) {
      const rider = await db.users.findOneAsync({ _id: ride.riderId });
      await db.users.updateAsync({ _id: ride.riderId }, { $set: { totalRides: (rider.totalRides || 0) + 1 } });
      await createNotification(ride.riderId, {
        type: 'ride_completed', rideId: ride._id,
        title: '✅ Ride Completed!',
        message: `You reached your destination. Total fare: ₹${actualFare}. Please rate your driver!`,
        icon: '✅', amount: actualFare,
      });
    }

    const io = req.app.get('io');
    if (io) {
      const rider = await db.users.findOneAsync({ _id: ride.riderId });
      if (rider?.socketId) io.to(rider.socketId).emit('ride_completed', { rideId: ride._id, fare: actualFare, distance: ride.distance });
    }

    res.json(await populateRide(await db.rides.findOneAsync({ _id: req.params.id })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT /api/rides/:id/cancel
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await db.rides.findOneAsync({ _id: req.params.id });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (!['requested','accepted'].includes(ride.status)) return res.status(400).json({ message: 'Cannot cancel now' });

    await db.rides.updateAsync({ _id: req.params.id }, { $set: { status: 'cancelled', cancelReason: reason || 'No reason', cancelledBy: req.user.role } });

    // Refund wallet if applicable
    if (ride.paymentMethod === 'wallet' && ride.paymentStatus === 'paid') {
      const actualFare = ride.fare?.finalFare || ride.fare?.estimated;
      const rider = await db.users.findOneAsync({ _id: ride.riderId });
      const newBal = (rider.walletBalance || 0) + actualFare;
      await db.users.updateAsync({ _id: ride.riderId }, { $set: { walletBalance: newBal } });
      await createNotification(ride.riderId, {
        type: 'wallet_refund', rideId: ride._id,
        title: '💰 Refund Processed!',
        message: `₹${actualFare} refunded to your wallet. New balance: ₹${newBal}`,
        icon: '💰', amount: actualFare,
      });
    }

    if (ride.driverId) await db.users.updateAsync({ _id: ride.driverId }, { $set: { isAvailable: true } });

    const cancelledByName = req.user.role === 'rider' ? 'Rider' : 'Driver';
    const targetId = req.user.role === 'rider' ? ride.driverId : ride.riderId;

    await createNotification(req.user._id, {
      type: 'ride_cancelled', rideId: ride._id,
      title: '❌ Ride Cancelled',
      message: `You cancelled the ride. Reason: ${reason || 'No reason provided'}`,
      icon: '❌',
    });

    if (targetId) {
      await createNotification(targetId, {
        type: 'ride_cancelled', rideId: ride._id,
        title: '❌ Ride Cancelled',
        message: `${cancelledByName} cancelled the ride. Reason: ${reason || 'No reason provided'}`,
        icon: '❌',
      });
    }

    const io = req.app.get('io');
    if (io && targetId) {
      const target = await db.users.findOneAsync({ _id: targetId });
      if (target?.socketId) io.to(target.socketId).emit('ride_cancelled', { rideId: ride._id, cancelledBy: req.user.role, reason });
    }

    res.json({ message: 'Ride cancelled' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/rides/history
router.get('/history', protect, async (req, res) => {
  try {
    const query = req.user.role === 'rider'
      ? { riderId: req.user._id, status: { $in: ['completed','cancelled'] } }
      : { driverId: req.user._id, status: { $in: ['completed','cancelled'] } };
    const rides = await db.rides.findAsync(query).sort({ createdAt: -1 });
    const populated = await Promise.all(rides.slice(0,20).map(populateRide));
    res.json(populated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/rides/active
router.get('/active', protect, async (req, res) => {
  try {
    const query = req.user.role === 'rider' ? { riderId: req.user._id } : { driverId: req.user._id };
    const ride = await db.rides.findOneAsync({ ...query, status: { $in: ['requested','accepted','driver_arriving','in_progress'] } });
    res.json(ride ? await populateRide(ride) : null);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/rides/available
router.get('/available', protect, async (req, res) => {
  try {
    const rides = await db.rides.findAsync({ status: 'requested', rideType: req.user.vehicleDetails?.type || 'mini' }).sort({ createdAt: -1 });
    const populated = await Promise.all(rides.map(populateRide));
    res.json(populated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT /api/rides/:id/rate
router.put('/:id/rate', protect, async (req, res) => {
  try {
    const { rating } = req.body;
    const ride = await db.rides.findOneAsync({ _id: req.params.id });
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (req.user.role === 'rider') {
      await db.rides.updateAsync({ _id: req.params.id }, { $set: { 'rating.driverRating': rating } });
    } else {
      await db.rides.updateAsync({ _id: req.params.id }, { $set: { 'rating.riderRating': rating } });
    }
    res.json({ message: 'Rating submitted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
