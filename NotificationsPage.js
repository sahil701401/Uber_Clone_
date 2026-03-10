import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const TYPE_ICONS = {
  welcome: '🎉', ride: '🚕', wallet: '💰', promo: '🎟️', system: '🔔',
};

const TYPE_COLORS = {
  welcome: '#f5a623', ride: '#e94560', wallet: '#27ae60', promo: '#9b59b6', system: '#0f3460',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await axios.get('/api/notifications');
      setNotifications(data.notifications);
    } catch { toast.error('Failed to load notifications'); }
    finally { setLoading(false); }
  };

  const markAllRead = async () => {
    try {
      await axios.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await axios.put(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  };

  const clearAll = async () => {
    try {
      await axios.delete('/api/notifications');
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="feature-page">
      <div className="feature-header">
        <button className="back-btn" onClick={() => navigate(user.role === 'driver' ? '/driver' : '/rider')}>← Back</button>
        <h2>🔔 Notifications {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</h2>
        {notifications.length > 0 && (
          <div className="notif-actions">
            {unreadCount > 0 && <button className="text-btn" onClick={markAllRead}>Mark all read</button>}
            <button className="text-btn danger" onClick={clearAll}>Clear all</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <span>🔔</span>
          <p>No notifications yet. Book a ride to get started!</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(notif => (
            <div
              key={notif._id}
              className={`notif-card ${notif.read ? 'read' : 'unread'}`}
              onClick={() => !notif.read && markRead(notif._id)}
            >
              <div className="notif-icon" style={{ background: TYPE_COLORS[notif.type] || '#0f3460' }}>
                {TYPE_ICONS[notif.type] || '🔔'}
              </div>
              <div className="notif-content">
                <div className="notif-title">{notif.title}</div>
                <div className="notif-message">{notif.message}</div>
                <div className="notif-time">{formatDate(notif.createdAt)}</div>
              </div>
              <div className="notif-right">
                {!notif.read && <div className="unread-dot"></div>}
                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
