import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRideHistory } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function RideHistory() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getRideHistory()
      .then(({ data }) => setRides(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalEarnings = rides.filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.fare?.actual || 0), 0);

  return (
    <div className="history-page">
      <div className="history-header">
        <button className="back-btn" onClick={() => navigate(user.role === 'driver' ? '/driver' : '/rider')}>
          ← Back
        </button>
        <h2>Ride History 📜</h2>
        {user.role === 'driver' && (
          <div className="earnings-summary">Total Earnings: <strong>₹{totalEarnings}</strong></div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Loading rides...</div>
      ) : rides.length === 0 ? (
        <div className="empty-state">
          <span>🚕</span>
          <p>No rides yet! Book your first ride in Jaipur.</p>
        </div>
      ) : (
        <div className="rides-list">
          {rides.map(ride => (
            <div key={ride._id} className={`ride-card ${ride.status}`}>
              <div className="ride-card-header">
                <div className="ride-type-badge">{ride.rideType?.toUpperCase()}</div>
                <div className={`ride-status-tag ${ride.status}`}>{ride.status}</div>
                <div className="ride-date">
                  {new Date(ride.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </div>
              </div>
              <div className="ride-route">
                <div className="route-point pickup">
                  <span className="dot green"></span>
                  <span>{ride.pickup?.address}</span>
                </div>
                <div className="route-line"></div>
                <div className="route-point destination">
                  <span className="dot red"></span>
                  <span>{ride.destination?.address}</span>
                </div>
              </div>
              <div className="ride-meta">
                {ride.status === 'completed' && (
                  <>
                    <span>💰 ₹{ride.fare?.actual || ride.fare?.estimated}</span>
                    <span>📏 {Number(ride.distance).toFixed(1)} km</span>
                    <span>⏱ {ride.duration} min</span>
                  </>
                )}
                {ride.status === 'cancelled' && (
                  <span className="cancel-reason">❌ {ride.cancelReason}</span>
                )}
                {user.role === 'rider' && ride.driver && (
                  <span>🚗 {ride.driver.name}</span>
                )}
                {user.role === 'driver' && ride.rider && (
                  <span>👤 {ride.rider.name}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
