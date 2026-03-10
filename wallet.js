const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

// GET /api/wallet - get balance + transactions
router.get('/', protect, async (req, res) => {
  try {
    const user = await db.users.findOneAsync({ _id: req.user._id });
    const transactions = await db.transactions.findAsync({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ balance: user.walletBalance || 0, transactions });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// POST /api/wallet/add - add money to wallet
router.post('/add', protect, async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (!amount || amount < 10) return res.status(400).json({ message: 'Minimum add amount is ₹10' });
    if (amount > 10000) return res.status(400).json({ message: 'Maximum add amount is ₹10,000' });

    const user = await db.users.findOneAsync({ _id: req.user._id });
    const newBalance = (user.walletBalance || 0) + Number(amount);

    await db.users.updateAsync({ _id: req.user._id }, { $set: { walletBalance: newBalance } });

    const txn = await db.transactions.insertAsync({
      userId: req.user._id,
      type: 'credit',
      amount: Number(amount),
      description: `Wallet topped up via ${method || 'UPI'}`,
      method: method || 'UPI',
      status: 'success',
      balanceAfter: newBalance,
      createdAt: new Date(),
    });

    await createNotification(req.user._id, {
      type: 'wallet_credit',
      title: '💰 Wallet Credited!',
      message: `₹${amount} added to your wallet via ${method || 'UPI'}. New balance: ₹${newBalance}`,
      icon: '💰',
      amount: Number(amount),
    });

    // Emit real-time wallet update
    const io = req.app.get('io');
    if (io) {
      const userSocket = await db.users.findOneAsync({ _id: req.user._id });
      if (userSocket?.socketId) {
        io.to(userSocket.socketId).emit('wallet_updated', { balance: newBalance, transaction: txn });
      }
    }

    res.json({ balance: newBalance, transaction: txn });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// GET /api/wallet/transactions
router.get('/transactions', protect, async (req, res) => {
  try {
    const transactions = await db.transactions.findAsync({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
