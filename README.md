# 🚕 Uber Jaipur Clone — MERN Stack

A fully functional Uber clone built with the **MERN Stack** (MongoDB, Express, React, Node.js), featuring real-time ride tracking with **Socket.io** and interactive maps via **Leaflet.js** — restricted to **Jaipur, Rajasthan**.

---

## ✨ Features

### 🧍 Rider App
- 📍 Book rides with Jaipur autocomplete locations (25+ landmarks)
- 💰 Real-time fare estimation for Auto / Mini / Sedan / SUV
- 🗺️ Interactive Jaipur map (Leaflet + OpenStreetMap, no API key!)
- 🔴 Live driver location tracking on map
- 🔑 OTP-based ride verification
- 💬 In-app chat with driver
- ⭐ Rate your driver after ride
- 📜 Ride history

### 🚗 Driver App
- 🟢 Go online/offline toggle
- 🔔 Real-time ride request notifications
- ✅ Accept / ❌ Decline ride requests
- 📡 Live GPS location broadcasting
- 🔑 OTP verification to start ride
- 💬 In-app chat with rider
- 💰 Earnings tracker
- 📜 Trip history

### 🛠️ Technical Features
- **JWT Authentication** with 30-day tokens
- **Socket.io** for real-time bidirectional communication
- **Haversine formula** for distance & fare calculation
- **MongoDB 2dsphere index** for geospatial driver queries
- **Jaipur map bounds** — map is locked to Jaipur city limits
- **Responsive design** — works on mobile and desktop

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js v18+
- MongoDB (local or [MongoDB Atlas](https://cloud.mongodb.com))
- Git

### Step 1 — Clone & Install

```bash
# Navigate to project root
cd uber-jaipur

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2 — Configure Environment

```bash
# In /backend folder, create .env file:
cp .env.example .env
```

Edit `backend/.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/uber-jaipur
JWT_SECRET=change_this_to_a_strong_secret_key
NODE_ENV=development
```

> **MongoDB Atlas**: Replace `MONGODB_URI` with your Atlas connection string:
> `mongodb+srv://<user>:<password>@cluster.mongodb.net/uber-jaipur`

### Step 3 — Run the App

**Option A — Run both together (recommended):**
```bash
# From root folder
npm run dev
```

**Option B — Run separately:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### Step 4 — Access the App

| Service | URL |
|---------|-----|
| Frontend (React) | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| API Health Check | http://localhost:5000/api/health |

---

## 🧪 Testing the App

### Create Test Accounts

**Test Rider:**
- Go to http://localhost:3000/register
- Select "I'm a Rider"
- Fill in details and register

**Test Driver:**
- Go to http://localhost:3000/register
- Select "I'm a Driver"
- Fill vehicle details:
  - Type: Mini
  - Model: Maruti Swift
  - Plate: RJ14 AB 1234
  - Color: White

### Complete a Ride Flow

1. Open two browser tabs (or incognito windows)
2. **Tab 1** — Log in as Rider → Select pickup (e.g., "Hawa Mahal") → Select destination (e.g., "Jaipur Airport") → See fare estimates → Book Ride
3. **Tab 2** — Log in as Driver → Go Online → Accept the ride request
4. **Tab 1** — See driver info + OTP
5. **Tab 2** — Enter OTP to start ride → Complete ride
6. **Tab 1** — Rate driver ⭐

---

## 🗺️ Map Details

- **Map Library**: Leaflet.js + OpenStreetMap (completely free, no API key)
- **Center**: Jaipur (26.9124°N, 75.7873°E)
- **Bounds**: Locked to Jaipur city limits
- **Min Zoom**: 11 (full city view)
- **Max Zoom**: 18 (street level)
- **25+ Jaipur locations** for autocomplete including:
  - Hawa Mahal, Amber Fort, City Palace, Jantar Mantar
  - Jaipur Railway Station, International Airport
  - World Trade Park, Pink Square Mall
  - Mansarovar, Vaishali Nagar, Malviya Nagar, MI Road
  - And many more!

---

## 💰 Fare Structure (Jaipur Rates in ₹)

| Vehicle | Base Fare | Per KM | Per Min |
|---------|-----------|--------|---------|
| 🛺 Auto | ₹30 | ₹12 | ₹1.5 |
| 🚗 Mini | ₹50 | ₹14 | ₹2 |
| 🚙 Sedan | ₹80 | ₹18 | ₹2.5 |
| 🚐 SUV | ₹100 | ₹22 | ₹3 |

---

## 📁 Project Structure

```
uber-jaipur/
├── backend/
│   ├── server.js              # Express + Socket.io server
│   ├── config/db.js           # MongoDB connection
│   ├── models/
│   │   ├── User.js            # User schema (rider + driver)
│   │   └── Ride.js            # Ride schema
│   ├── routes/
│   │   ├── auth.js            # Register, Login, Location
│   │   └── rides.js           # Book, Accept, Start, Complete
│   ├── middleware/auth.js     # JWT middleware
│   ├── socket/index.js        # Real-time Socket.io events
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── App.js             # Routes + Auth
│       ├── App.css            # Full styling (Pink City theme)
│       ├── context/
│       │   └── AuthContext.js # Global auth state
│       ├── utils/
│       │   ├── api.js         # Axios API calls
│       │   ├── socket.js      # Socket.io client
│       │   └── jaipurLocations.js  # 25+ Jaipur places
│       ├── components/
│       │   ├── JaipurMap.js   # Leaflet map component
│       │   └── LocationSearch.js   # Autocomplete search
│       └── pages/
│           ├── Login.js
│           ├── Register.js
│           ├── RiderDashboard.js   # Full rider app
│           ├── DriverDashboard.js  # Full driver app
│           └── RideHistory.js
│
└── package.json               # Root: runs both servers
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register rider or driver |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/update-location` | Update driver GPS |
| PUT | `/api/auth/toggle-availability` | Driver online/offline |

### Rides
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rides/estimate` | Get fare estimates |
| POST | `/api/rides/book` | Book a ride |
| GET | `/api/rides/active` | Get current active ride |
| GET | `/api/rides/history` | Ride history |
| PUT | `/api/rides/:id/accept` | Driver accepts ride |
| PUT | `/api/rides/:id/start` | Start ride (OTP) |
| PUT | `/api/rides/:id/complete` | Complete ride |
| PUT | `/api/rides/:id/cancel` | Cancel ride |
| PUT | `/api/rides/:id/rate` | Rate ride |

### Socket.io Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `register_user` | Client → Server | Register socket for notifications |
| `new_ride_request` | Server → Driver | New ride available |
| `ride_accepted` | Server → Rider | Driver accepted |
| `driver_location_update` | Driver → Server | GPS position |
| `driver_location` | Server → Rider | Driver's live position |
| `driver_arriving` | Server → Rider | Driver nearby |
| `ride_started` | Server → Rider | Ride begun |
| `ride_completed` | Server → Rider | Trip done |
| `ride_cancelled` | Server → Both | Ride cancelled |
| `send_message` | Client → Server | Chat message |
| `receive_message` | Server → Client | Incoming chat |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6 |
| State Management | React Context API |
| Maps | Leaflet.js + OpenStreetMap |
| Real-time | Socket.io |
| HTTP Client | Axios |
| UI | Custom CSS + Google Fonts (Poppins) |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Authentication | JWT + bcryptjs |
| Real-time Server | Socket.io |

---

## 🚀 Future Enhancements

- [ ] Payment gateway (Razorpay UPI integration)
- [ ] Push notifications
- [ ] Admin dashboard
- [ ] Driver earnings analytics
- [ ] Scheduled rides
- [ ] Surge pricing based on demand
- [ ] Route optimization with OSRM API
- [ ] Promo codes & wallet
