// NotificationBell.jsx
import React from 'react';
import { FiBell } from 'react-icons/fi';
import useNotificationStore from '../store/useNotificationStore';
import { useShallow } from 'zustand/react/shallow';
import '../css/NotificationBell.css';

function NotificationBell() {
  const { unreadCount, togglePanel } = useNotificationStore(
    useShallow((state) => ({
      unreadCount: state.unreadCount,
      togglePanel: state.togglePanel,
    }))
  );

  return (
    <span
      className="notification-bell"
      onClick={togglePanel}
      aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      title="Notifications"
    >
      <FiBell />
      {unreadCount > 0 && (
        <span className="notification-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </span>
  );
}

export default NotificationBell;
