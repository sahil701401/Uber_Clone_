import React, { useState, useEffect } from 'react';
import { getNotifications, markAllRead, clearNotifications, markOneRead } from '../utils/api';
import toast from 'react-hot-toast';

const TYPE_COLORS = {
  welcome:        '#f5a623',
  ride_requested: '#0f3460',
  ride_accepted:  '#27ae60',
  ride_started:   '#3498db',
  ride_completed: '#27ae60',
  ride_cancelled: '#e74c3c',
  wallet_credit:  '#27ae60',
  wallet_debit:   '#e94560',
  wallet_refund:  '#f5a623',
  ride_earning:   '#27ae60',
  promo_applied:  '#9b59b6',
};

export default function NotificationsPanel({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const { data } = await getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifs(); }, []);

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleMarkOne = async (id) => {
    await markOneRead(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleClear = async () => {
    await clearNotifications();
    setNotifications([]);
    setUnreadCount(0);
    toast.success('Notifications cleared');
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="notif-overlay" onClick={onClose}>
      <div className="notif-panel" onClick={e => e.stopPropagation()}>
        <div className="notif-header">
          <div className="notif-title">
            <span>🔔</span>
            <h3>Notifications</h3>
            {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </div>
          <div className="notif-actions">
            {unreadCount > 0 && (
              <button className="notif-action-btn" onClick={handleMarkAllRead}>Mark all read</button>
            )}
            {notifications.length > 0 && (
              <button className="notif-action-btn danger" onClick={handleClear}>Clear all</button>
            )}
            <button className="notif-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="notif-list">
          {loading ? (
            <div className="notif-empty">
              <div className="spinner"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">
              <span>🔕</span>
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n._id}
                className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                style={{ borderLeftColor: TYPE_COLORS[n.type] || '#e94560' }}
                onClick={() => !n.isRead && handleMarkOne(n._id)}
              >
                <div className="notif-icon">{n.icon}</div>
                <div className="notif-content">
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-msg">{n.message}</div>
                  {n.amount && (
                    <div className="notif-amount" style={{ color: n.type.includes('debit') ? '#e74c3c' : '#27ae60' }}>
                      {n.type.includes('debit') ? '-' : '+'}₹{n.amount}
                    </div>
                  )}
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && <div className="unread-dot"></div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
