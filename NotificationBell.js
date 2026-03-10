import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = getSocket();

  useEffect(() => {
    fetchUnreadCount();

    socket.on('new_notification', () => {
      setUnreadCount(prev => prev + 1);
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    });

    return () => socket.off('new_notification');
  }, [socket]);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await axios.get('/api/notifications');
      setUnreadCount(data.unreadCount);
    } catch {}
  };

  return (
    <button
      className={`notification-bell ${pulse ? 'pulse' : ''}`}
      onClick={() => navigate('/notifications')}
      title="Notifications"
    >
      🔔
      {unreadCount > 0 && (
        <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </button>
  );
}
