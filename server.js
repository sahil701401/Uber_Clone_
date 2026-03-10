const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

require('./config/db');
const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: ['http://localhost:3000','http://127.0.0.1:3000'], methods: ['GET','POST','PUT','DELETE'], credentials: true }
});
app.set('io', io);

app.use(cors({ origin: ['http://localhost:3000','http://127.0.0.1:3000'], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/rides',         require('./routes/rides'));
app.use('/api/wallet',        require('./routes/wallet'));
app.use('/api/promos',        require('./routes/promos'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: '🚕 Uber Jaipur V2 Running!' }));

setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`💰 Wallet System: Active`);
  console.log(`🎟️  Promo Codes: Active`);
  console.log(`🔔 Notifications: Active\n`);
});
