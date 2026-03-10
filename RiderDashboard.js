import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import JaipurMap from '../components/JaipurMap';
import LocationSearch from '../components/LocationSearch';
import NotificationsPanel from '../components/NotificationsPanel';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import { estimateFare, bookRide, cancelRide, getActiveRide, rateRide, validatePromo, getAvailablePromos, getNotifications, getWallet } from '../utils/api';

const RIDE_TYPES = [
  { key: 'auto',  label: 'Auto',  icon: '🛺', desc: 'Affordable 3 seats' },
  { key: 'mini',  label: 'Mini',  icon: '🚗', desc: 'Economy 4 seats' },
  { key: 'sedan', label: 'Sedan', icon: '🚙', desc: 'Comfort 4 seats' },
  { key: 'suv',   label: 'SUV',   icon: '🚐', desc: 'Premium 6 seats' },
];

const STATUS_LABELS = {
  requested:      { label: 'Looking for drivers...', color: '#f5a623', icon: '🔍' },
  accepted:       { label: 'Driver is on the way!',  color: '#0f3460', icon: '🚕' },
  driver_arriving:{ label: 'Driver is almost here!', color: '#e94560', icon: '📍' },
  in_progress:    { label: 'Ride in progress',       color: '#27ae60', icon: '🛣️' },
  completed:      { label: 'Ride completed!',        color: '#27ae60', icon: '✅' },
  cancelled:      { label: 'Ride cancelled',         color: '#e74c3c', icon: '❌' },
};

export default function RiderDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [estimates, setEstimates] = useState(null);
  const [selectedType, setSelectedType] = useState('mini');
  const [activeRide, setActiveRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [stage, setStage] = useState('search');
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [availablePromos, setAvailablePromos] = useState([]);
  const [showPromos, setShowPromos] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    const checkActive = async () => {
      try {
        const { data } = await getActiveRide();
        if (data) { setActiveRide(data); setPickup(data.pickup.coordinates); setDestination(data.destination.coordinates); setStage('active'); }
      } catch {}
    };
    checkActive();
    fetchNotifCount();
    fetchWallet();
  }, []);

  const fetchNotifCount = async () => {
    try { const { data } = await getNotifications(); setUnreadCount(data.unreadCount); } catch {}
  };

  const fetchWallet = async () => {
    try { const { data } = await getWallet(); setWalletBalance(data.balance); } catch {}
  };

  useEffect(() => {
    socket.emit('register_user', { userId: user._id });

    socket.on('ride_accepted', ({ rideId, driver, otp }) => {
      toast.success('Driver ' + driver.name + ' accepted your ride!');
      setActiveRide(prev => prev ? { ...prev, driver, status: 'accepted', otp } : prev);
      setUnreadCount(c => c + 1);
    });
    socket.on('driver_location', ({ lat, lng }) => setDriverLocation({ lat, lng }));
    socket.on('driver_arriving', () => {
      toast.success('Driver is arriving! Get ready!');
      setActiveRide(prev => prev ? { ...prev, status: 'driver_arriving' } : prev);
    });
    socket.on('ride_started', () => {
      toast.success('Ride started! Enjoy your trip!');
      setActiveRide(prev => prev ? { ...prev, status: 'in_progress' } : prev);
    });
    socket.on('ride_completed', ({ fare }) => {
      toast.success('Ride completed! Fare: Rs.' + fare);
      setActiveRide(prev => prev ? { ...prev, status: 'completed', fare: { ...prev.fare, actual: fare } } : prev);
      setStage('completed');
      fetchWallet();
      setUnreadCount(c => c + 1);
    });
    socket.on('ride_cancelled', ({ cancelledBy, reason }) => {
      toast.error('Ride cancelled by ' + cancelledBy);
      setActiveRide(null); setStage('search');
    });
    socket.on('receive_message', ({ senderName, message }) => {
      setMessages(prev => [...prev, { from: senderName, text: message, mine: false }]);
      toast(senderName + ': ' + message);
    });
    socket.on('wallet_updated', ({ balance }) => setWalletBalance(balance));

    return () => {
      socket.off('ride_accepted'); socket.off('driver_location'); socket.off('driver_arriving');
      socket.off('ride_started'); socket.off('ride_completed'); socket.off('ride_cancelled');
      socket.off('receive_message'); socket.off('wallet_updated');
    };
  }, [socket, user._id]);

  const getFareEstimates = async () => {
    if (!pickup || !destination) return toast.error('Select pickup and destination');
    setLoading(true);
    try {
      const { data } = await estimateFare({ pickup: { coordinates: pickup }, destination: { coordinates: destination } });
      setEstimates(data.estimates);
      setStage('estimate');
      setPromoResult(null); setPromoCode('');
      const { data: promos } = await getAvailablePromos();
      setAvailablePromos(promos.filter(p => !p.alreadyUsed && !p.limitReached));
    } catch { toast.error('Failed to get estimates'); }
    finally { setLoading(false); }
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return toast.error('Enter a promo code');
    const currentFare = estimates?.[selectedType]?.fare;
    if (!currentFare) return;
    setValidatingPromo(true);
    try {
      const { data } = await validatePromo({ code: promoCode, fare: currentFare });
      setPromoResult(data);
      toast.success('Promo applied! You save Rs.' + data.discount);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid promo code');
      setPromoResult(null);
    } finally { setValidatingPromo(false); }
  };

  const handleBookRide = async () => {
    if (paymentMethod === 'wallet' && walletBalance < (promoResult?.finalFare || estimates?.[selectedType]?.fare)) {
      return toast.error('Insufficient wallet balance. Please add money to wallet.');
    }
    setLoading(true);
    try {
      const { data } = await bookRide({
        pickup: { address: pickup.address || 'Pickup point', coordinates: pickup },
        destination: { address: destination.address || 'Destination', coordinates: destination },
        rideType: selectedType, paymentMethod,
        promoCode: promoResult ? promoCode : null,
        discountAmount: promoResult?.discount || 0,
      });
      setActiveRide(data); setStage('active');
      toast.success('Searching for nearby drivers...');
      if (paymentMethod === 'wallet') fetchWallet();
    } catch (err) { toast.error(err.response?.data?.message || 'Booking failed'); }
    finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!activeRide) return;
    try { await cancelRide(activeRide._id, 'Cancelled by rider'); setActiveRide(null); setStage('search'); toast('Ride cancelled'); }
    catch { toast.error('Failed to cancel'); }
  };

  const sendMessage = () => {
    if (!msgInput.trim() || !activeRide) return;
    socket.emit('send_message', { rideId: activeRide._id, senderId: user._id, senderName: user.name, message: msgInput });
    setMessages(prev => [...prev, { from: 'You', text: msgInput, mine: true }]);
    setMsgInput('');
  };

  const submitRating = async (stars) => {
    setRating(stars);
    try {
      await rateRide(activeRide._id, stars);
      toast.success('Thanks for rating!');
      setTimeout(() => { setActiveRide(null); setPickup(null); setDestination(null); setEstimates(null); setStage('search'); setMessages([]); setPromoResult(null); }, 1500);
    } catch {}
  };

  const finalFare = promoResult ? promoResult.finalFare : estimates?.[selectedType]?.fare;

  return (
    <div className="dashboard">
      {showNotifs && <NotificationsPanel onClose={() => { setShowNotifs(false); setUnreadCount(0); fetchNotifCount(); }}/>}

      <div className="sidebar">
        <div className="sidebar-header">
          <div className="brand"><span>🚕</span><div><h2>Uber Jaipur</h2><p className="brand-sub">Pink City Rides</p></div></div>
          <div className="user-info">
            <div className="avatar">{user.name[0]}</div>
            <div><div className="user-name">{user.name}</div><div className="user-rating">⭐ {user.rating?.toFixed(1)||'5.0'}</div></div>
            <div className="header-actions">
              <button className="notif-bell" onClick={() => setShowNotifs(true)}>
                🔔{unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
              </button>
            </div>
          </div>
          <div className="wallet-bar" onClick={() => navigate('/wallet')}>
            <span>💰 Wallet</span>
            <span className="wallet-bal">Rs.{walletBalance.toFixed(0)}</span>
            <span className="wallet-add">+ Add</span>
          </div>
        </div>

        <div className="sidebar-content">
          {stage === 'search' && (
            <div className="booking-panel">
              <h3>Book a Ride</h3>
              <div className="location-inputs">
                <div className="loc-line"><div className="loc-dot green"></div>
                  <LocationSearch placeholder="Pickup location in Jaipur" icon="🟢" value={pickup} onChange={setPickup}/>
                </div>
                <div className="loc-line"><div className="loc-dot red"></div>
                  <LocationSearch placeholder="Where to in Jaipur?" icon="🔴" value={destination} onChange={setDestination}/>
                </div>
              </div>
              <button className="btn-primary" onClick={getFareEstimates} disabled={loading||!pickup||!destination}>
                {loading ? <span className="spinner"></span> : 'See Prices'}
              </button>
            </div>
          )}

          {stage === 'estimate' && estimates && (
            <div className="estimate-panel">
              <div className="panel-header">
                <button className="back-btn" onClick={() => setStage('search')}>Back</button>
                <h3>Choose a Ride</h3>
              </div>
              <div className="ride-types">
                {RIDE_TYPES.map(rt => (
                  <div key={rt.key} className={"ride-type-card " + (selectedType===rt.key?'selected':'')} onClick={() => { setSelectedType(rt.key); setPromoResult(null); setPromoCode(''); }}>
                    <span className="rt-icon">{rt.icon}</span>
                    <div className="rt-info"><div className="rt-name">{rt.label}</div><div className="rt-desc">{rt.desc}</div></div>
                    <div className="rt-fare">Rs.{estimates[rt.key]?.fare}</div>
                  </div>
                ))}
              </div>

              <div className="trip-info">
                <span>📍 {estimates[selectedType]?.distance} km</span>
                <span>⏱ ~{estimates[selectedType]?.duration} min</span>
              </div>

              {/* Promo Code Section */}
              <div className="promo-section">
                <div className="promo-input-row">
                  <input className="promo-input" placeholder="Enter promo code" value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}/>
                  <button className="promo-apply-btn" onClick={handleValidatePromo} disabled={validatingPromo}>
                    {validatingPromo ? '...' : 'Apply'}
                  </button>
                </div>
                {promoResult && (
                  <div className="promo-success">
                    <span>🎉 {promoResult.description}</span>
                    <span className="promo-saving">You save Rs.{promoResult.discount}!</span>
                  </div>
                )}
                <button className="show-promos-btn" onClick={() => setShowPromos(!showPromos)}>
                  🎟️ {availablePromos.length} promo codes available
                </button>
                {showPromos && (
                  <div className="promos-list">
                    {availablePromos.map(p => (
                      <div key={p.code} className="promo-chip" onClick={() => { setPromoCode(p.code); setShowPromos(false); }}>
                        <strong>{p.code}</strong> — {p.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="payment-select">
                <label>Payment</label>
                <div className="payment-options">
                  <button className={"pay-opt " + (paymentMethod==='cash'?'active':'')} onClick={() => setPaymentMethod('cash')}>💵 Cash</button>
                  <button className={"pay-opt " + (paymentMethod==='wallet'?'active':'')} onClick={() => setPaymentMethod('wallet')}>
                    💰 Wallet (Rs.{walletBalance})
                  </button>
                  <button className={"pay-opt " + (paymentMethod==='upi'?'active':'')} onClick={() => setPaymentMethod('upi')}>📱 UPI</button>
                </div>
              </div>

              {/* Fare Summary */}
              <div className="fare-summary">
                <div className="fare-row"><span>Base Fare</span><span>Rs.{estimates[selectedType]?.fare}</span></div>
                {promoResult && <div className="fare-row discount"><span>Promo Discount</span><span>-Rs.{promoResult.discount}</span></div>}
                <div className="fare-row total"><span>Total</span><strong>Rs.{finalFare}</strong></div>
              </div>

              <button className="btn-primary" onClick={handleBookRide} disabled={loading}>
                {loading ? <span className="spinner"></span> : 'Book ' + RIDE_TYPES.find(r=>r.key===selectedType)?.icon + ' Rs.' + finalFare}
              </button>
            </div>
          )}

          {stage === 'active' && activeRide && (
            <div className="active-ride-panel">
              <div className="ride-status-banner" style={{ borderColor: STATUS_LABELS[activeRide.status]?.color }}>
                <span>{STATUS_LABELS[activeRide.status]?.icon}</span>
                <span>{STATUS_LABELS[activeRide.status]?.label}</span>
              </div>
              {activeRide.status === 'requested' && (
                <div className="searching-animation"><div className="pulse-ring"></div><div className="searching-text">Searching for drivers near you...</div></div>
              )}
              {activeRide.driver && (
                <div className="driver-card">
                  <div className="driver-avatar">{activeRide.driver.name?.[0]||'D'}</div>
                  <div className="driver-info">
                    <div className="driver-name">{activeRide.driver.name}</div>
                    <div className="driver-rating">⭐ {activeRide.driver.rating?.toFixed(1)}</div>
                    <div className="driver-vehicle">{activeRide.driver.vehicleDetails?.color} {activeRide.driver.vehicleDetails?.model}</div>
                    <div className="driver-plate">{activeRide.driver.vehicleDetails?.plateNumber}</div>
                  </div>
                  <a href={"tel:"+activeRide.driver.phone} className="call-btn">📞</a>
                </div>
              )}
              {activeRide.otp && activeRide.status !== 'in_progress' && (
                <div className="otp-display">
                  <span>Ride OTP</span>
                  <strong>{activeRide.otp}</strong>
                  <span className="otp-hint">Share with driver to start ride</span>
                </div>
              )}
              <div className="trip-details-mini">
                <div>📍 {activeRide.pickup?.address}</div>
                <div>🏁 {activeRide.destination?.address}</div>
                <div>💰 Est: Rs.{activeRide.fare?.finalFare || activeRide.fare?.estimated}</div>
                {activeRide.promoCode && <div className="promo-tag">🎟️ {activeRide.promoCode} applied</div>}
                <div>💳 {activeRide.paymentMethod?.toUpperCase()}</div>
              </div>
              {activeRide.driver && (
                <div className="chat-box">
                  <div className="chat-messages">
                    {messages.map((m,i) => <div key={i} className={"chat-msg " + (m.mine?'mine':'theirs')}><span>{m.text}</span></div>)}
                  </div>
                  <div className="chat-input">
                    <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Message driver..." onKeyDown={e => e.key==='Enter'&&sendMessage()}/>
                    <button onClick={sendMessage}>Send</button>
                  </div>
                </div>
              )}
              {['requested','accepted'].includes(activeRide.status) && (
                <button className="btn-cancel" onClick={handleCancel}>Cancel Ride</button>
              )}
            </div>
          )}

          {stage === 'completed' && activeRide && (
            <div className="completed-panel">
              <div className="completion-header">✅ Ride Completed!</div>
              <div className="fare-display">
                <div className="fare-amount">Rs.{activeRide.fare?.actual || activeRide.fare?.estimated}</div>
                <div>{activeRide.paymentMethod?.toUpperCase()} Payment</div>
              </div>
              <div className="trip-summary">
                <div>📍 {activeRide.pickup?.address}</div>
                <div>🏁 {activeRide.destination?.address}</div>
                <div>📏 {activeRide.distance?.toFixed(2)} km</div>
                {activeRide.promoCode && <div>🎟️ Promo: {activeRide.promoCode}</div>}
              </div>
              <div className="rating-section">
                <p>Rate your driver</p>
                <div className="stars">
                  {[1,2,3,4,5].map(s => <span key={s} className={"star " + (s<=rating?'filled':'')} onClick={() => submitRating(s)}>★</span>)}
                </div>
              </div>
              <button className="btn-primary" onClick={() => { setActiveRide(null); setPickup(null); setDestination(null); setEstimates(null); setStage('search'); setMessages([]); setPromoResult(null); }}>Book Another Ride</button>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="nav-btn" onClick={() => navigate('/wallet')}>💰 Wallet</button>
          <button className="nav-btn" onClick={() => navigate('/history')}>📜 History</button>
          <button className="nav-btn logout" onClick={logout}>🚪 Logout</button>
        </div>
      </div>

      <div className="map-container">
        <JaipurMap pickup={pickup} destination={destination} driverLocation={driverLocation} flyTo={pickup && !destination ? [pickup.lat,pickup.lng] : null} height="100%" onRouteReady={(r) => { if (estimates) { const updated = {}; Object.keys(estimates).forEach(k => { const rates = {auto:{base:30,perKm:12,perMin:1.5},mini:{base:50,perKm:14,perMin:2},sedan:{base:80,perKm:18,perMin:2.5},suv:{base:100,perKm:22,perMin:3}}; const rate = rates[k]; updated[k] = { ...estimates[k], distance: r.distance, duration: r.duration, fare: Math.round(rate.base + parseFloat(r.distance)*rate.perKm + r.duration*rate.perMin) }; }); setEstimates(updated); } }}/>
        <div className="map-badge">📍 Jaipur, Rajasthan</div>
      </div>
    </div>
  );
}
