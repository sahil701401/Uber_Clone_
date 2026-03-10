import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import JaipurMap from '../components/JaipurMap';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import {
  toggleAvailability, getActiveRide, acceptRide,
  startRide, completeRide, cancelRide, updateLocation
} from '../utils/api';
import { JAIPUR_CENTER } from '../utils/jaipurLocations';

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(user.isAvailable || false);
  const [activeRide, setActiveRide] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [driverPos, setDriverPos] = useState({ lat: JAIPUR_CENTER[0], lng: JAIPUR_CENTER[1] });
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState(user.earnings || 0);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [stage, setStage] = useState('idle'); // idle | request | active | otp | completed
  const socket = getSocket();

  // Get driver GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          // Clamp to Jaipur bounds
          const clampedLat = Math.min(Math.max(lat, 26.70), 27.10);
          const clampedLng = Math.min(Math.max(lng, 75.55), 76.05);
          setDriverPos({ lat: clampedLat, lng: clampedLng });
          if (isOnline) {
            socket.emit('driver_location_update', {
              driverId: user._id, lat: clampedLat, lng: clampedLng
            });
            updateLocation({ lat: clampedLat, lng: clampedLng }).catch(() => {});
          }
        },
        () => {
          // Use Jaipur center if GPS fails
          setDriverPos({ lat: JAIPUR_CENTER[0], lng: JAIPUR_CENTER[1] });
        },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  }, [isOnline, socket, user._id]);

  // Check for active ride
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await getActiveRide();
        if (data) { setActiveRide(data); setStage('active'); }
      } catch {}
    };
    check();
  }, []);

  // Socket events
  useEffect(() => {
    socket.emit('register_user', { userId: user._id });

    socket.on('new_ride_request', (data) => {
      if (!isOnline) return;
      setPendingRequest(data);
      setStage('request');
      toast('🔔 New ride request!', { icon: '🚕' });
    });

    socket.on('receive_message', ({ senderName, message }) => {
      setMessages(prev => [...prev, { from: senderName, text: message, mine: false }]);
      toast(`💬 ${senderName}: ${message}`);
    });

    socket.on('ride_cancelled', ({ cancelledBy, reason }) => {
      toast.error(`❌ Ride cancelled by ${cancelledBy}`);
      setActiveRide(null);
      setPendingRequest(null);
      setStage('idle');
    });

    return () => {
      socket.off('new_ride_request');
      socket.off('receive_message');
      socket.off('ride_cancelled');
    };
  }, [socket, user._id, isOnline]);

  const handleToggleOnline = async () => {
    try {
      const { data } = await toggleAvailability();
      setIsOnline(data.isAvailable);
      toast(data.isAvailable ? '🟢 You are now online!' : '🔴 You are offline');
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const handleAcceptRide = async () => {
    if (!pendingRequest) return;
    setLoading(true);
    try {
      const { data } = await acceptRide(pendingRequest.rideId);
      setActiveRide(data);
      setPendingRequest(null);
      setStage('active');
      toast.success('✅ Ride accepted!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept');
      setPendingRequest(null);
      setStage('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRide = () => {
    setPendingRequest(null);
    setStage('idle');
    toast('Ride declined');
  };

  const handleStartRide = async () => {
    if (!otpInput || otpInput.length !== 4) return toast.error('Enter 4-digit OTP');
    setLoading(true);
    try {
      await startRide(activeRide._id, otpInput);
      setActiveRide(prev => ({ ...prev, status: 'in_progress' }));
      setOtpInput('');
      setStage('active');
      toast.success('🛣️ Ride started!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    setLoading(true);
    try {
      const { data } = await completeRide(activeRide._id);
      setEarnings(prev => prev + data.fare.actual);
      setActiveRide(data);
      setStage('completed');
      toast.success(`✅ Ride completed! Earned ₹${data.fare.actual}`);
    } catch (err) {
      toast.error('Failed to complete ride');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    try {
      await cancelRide(activeRide._id, 'Driver cancelled');
      setActiveRide(null);
      setStage('idle');
      toast('Ride cancelled');
    } catch {}
  };

  const sendMessage = () => {
    if (!msgInput.trim() || !activeRide) return;
    socket.emit('send_message', {
      rideId: activeRide._id,
      senderId: user._id,
      senderName: user.name,
      message: msgInput,
    });
    setMessages(prev => [...prev, { from: 'You', text: msgInput, mine: true }]);
    setMsgInput('');
  };

  return (
    <div className="dashboard">
      <div className="sidebar driver-sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span>🚗</span>
            <div>
              <h2>Driver Panel</h2>
              <p className="brand-sub">Uber Jaipur</p>
            </div>
          </div>
          <div className="user-info">
            <div className="avatar driver-avatar-pill">{user.name[0]}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-rating">⭐ {user.rating?.toFixed(1)} | {user.vehicleDetails?.type?.toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="driver-stats">
          <div className="stat-box">
            <div className="stat-value">₹{earnings}</div>
            <div className="stat-label">Today's Earnings</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{user.totalRides || 0}</div>
            <div className="stat-label">Total Rides</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{user.rating?.toFixed(1) || '5.0'}</div>
            <div className="stat-label">Rating</div>
          </div>
        </div>

        {/* Online Toggle */}
        <div className="online-toggle">
          <div className={`toggle-status ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isOnline ? 'Online — Ready for rides' : 'Offline'}
          </div>
          <button
            className={`toggle-btn ${isOnline ? 'go-offline' : 'go-online'}`}
            onClick={handleToggleOnline}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>

        <div className="sidebar-content">
          {/* IDLE */}
          {stage === 'idle' && (
            <div className="idle-panel">
              {isOnline ? (
                <div className="waiting">
                  <div className="pulse-ring"></div>
                  <p>Waiting for ride requests...</p>
                  <p className="hint">Stay in Jaipur area to receive rides</p>
                </div>
              ) : (
                <div className="offline-msg">
                  <span>🌙</span>
                  <p>You're offline. Go online to start accepting rides!</p>
                </div>
              )}
            </div>
          )}

          {/* NEW RIDE REQUEST */}
          {stage === 'request' && pendingRequest && (
            <div className="request-card animate-in">
              <div className="request-header">🔔 New Ride Request!</div>
              <div className="request-details">
                <div className="rd-row">
                  <span>📍</span>
                  <span>{pendingRequest.pickup?.address || 'Pickup location'}</span>
                </div>
                <div className="rd-row">
                  <span>🏁</span>
                  <span>{pendingRequest.destination?.address || 'Destination'}</span>
                </div>
                <div className="rd-row fare-row">
                  <span>💰 ₹{pendingRequest.fare}</span>
                  <span>📏 {Number(pendingRequest.distance).toFixed(1)} km</span>
                  <span>⏱ ~{pendingRequest.duration} min</span>
                </div>
                <div className="rd-row">
                  <span>👤 {pendingRequest.rider?.name}</span>
                  <span>⭐ {pendingRequest.rider?.rating?.toFixed(1)}</span>
                </div>
              </div>
              <div className="request-actions">
                <button className="btn-reject" onClick={handleRejectRide}>✕ Decline</button>
                <button className="btn-accept" onClick={handleAcceptRide} disabled={loading}>
                  {loading ? <span className="spinner"></span> : '✓ Accept'}
                </button>
              </div>
              <div className="request-timer">⏳ Request expires in 30s</div>
            </div>
          )}

          {/* ACTIVE RIDE */}
          {stage === 'active' && activeRide && (
            <div className="active-driver-panel">
              <div className="ride-status-badge">
                {activeRide.status === 'accepted' ? '🚕 Heading to pickup' : '🛣️ Ride in progress'}
              </div>
              <div className="rider-card">
                <div className="rider-avatar">{activeRide.rider?.name?.[0]}</div>
                <div>
                  <div className="rider-name">{activeRide.rider?.name}</div>
                  <div>⭐ {activeRide.rider?.rating?.toFixed(1)}</div>
                </div>
                <a href={`tel:${activeRide.rider?.phone}`} className="call-btn">📞</a>
              </div>

              <div className="trip-details-mini">
                <div>📍 {activeRide.pickup?.address}</div>
                <div>🏁 {activeRide.destination?.address}</div>
                <div>💰 ₹{activeRide.fare?.estimated} (estimated)</div>
              </div>

              {activeRide.status === 'accepted' && (
                <div className="otp-verify">
                  <p>Enter rider's OTP to start ride</p>
                  <input
                    type="number" maxLength={4} placeholder="0000"
                    value={otpInput} onChange={e => setOtpInput(e.target.value)}
                    className="otp-input"
                  />
                  <button className="btn-primary" onClick={handleStartRide} disabled={loading}>
                    {loading ? <span className="spinner"></span> : 'Start Ride 🚀'}
                  </button>
                </div>
              )}

              {activeRide.status === 'in_progress' && (
                <button className="btn-complete" onClick={handleCompleteRide} disabled={loading}>
                  {loading ? <span className="spinner"></span> : '✅ Complete Ride'}
                </button>
              )}

              {/* Chat */}
              <div className="chat-box">
                <div className="chat-messages">
                  {messages.map((m, i) => (
                    <div key={i} className={`chat-msg ${m.mine ? 'mine' : 'theirs'}`}>
                      <span>{m.text}</span>
                    </div>
                  ))}
                </div>
                <div className="chat-input">
                  <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                    placeholder="Message rider..." onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                  <button onClick={sendMessage}>➤</button>
                </div>
              </div>

              <button className="btn-cancel" onClick={handleCancelRide}>Cancel Ride</button>
            </div>
          )}

          {/* COMPLETED */}
          {stage === 'completed' && activeRide && (
            <div className="completed-panel">
              <div className="completion-header">✅ Trip Completed!</div>
              <div className="fare-display">
                <div className="fare-amount">₹{activeRide.fare?.actual}</div>
                <div>Earned this trip</div>
              </div>
              <button className="btn-primary" onClick={() => {
                setActiveRide(null); setStage('idle'); setMessages([]);
              }}>Ready for next ride</button>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="nav-btn" onClick={() => navigate('/history')}>📜 History</button>
          <button className="nav-btn logout" onClick={logout}>🚪 Logout</button>
        </div>
      </div>

      {/* Map */}
      <div className="map-container">
        <JaipurMap
          pickup={activeRide?.pickup?.coordinates}
          destination={activeRide?.destination?.coordinates}
          driverLocation={driverPos}
          flyTo={!activeRide ? [driverPos.lat, driverPos.lng] : null}
          height="100%"
        />
        <div className="map-badge">📍 Jaipur, Rajasthan</div>
        <div className="driver-location-badge">
          🟢 Your location: {driverPos.lat.toFixed(4)}, {driverPos.lng.toFixed(4)}
        </div>
      </div>
    </div>
  );
}
