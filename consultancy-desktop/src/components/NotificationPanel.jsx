import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiX,
  FiCheck,
  FiTrash2,
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
  FiAlertCircle,
} from 'react-icons/fi';
import { useShallow } from 'zustand/react/shallow';
import useNotificationStore from '../store/useNotificationStore';
import '../css/NotificationPanel.css';

const NotificationIcon = ({ type }) => {
  switch (type) {
    case 'success':
      return <FiCheckCircle className="notification-icon success" />;
    case 'warning':
      return <FiAlertTriangle className="notification-icon warning" />;
    case 'error':
      return <FiAlertCircle className="notification-icon error" />;
    default:
      return <FiInfo className="notification-icon info" />;
  }
};

function NotificationPanel() {
  const navigate = useNavigate();

  const {
    isOpen,
    filter,
    notifications,
    closePanel,
    setFilter,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotificationStore(
    useShallow((state) => ({
      isOpen: state.isOpen,
      filter: state.filter,
      notifications: state.notifications,
      closePanel: state.closePanel,
      setFilter: state.setFilter,
      markAsRead: state.markAsRead,
      markAllAsRead: state.markAllAsRead,
      deleteNotification: state.deleteNotification,
      clearAll: state.clearAll,
    }))
  );

  const isReminder = (n) =>
  n.category === 'reminder' || n.type === 'reminder';

const filteredNotifications = useMemo(() => {
  const list = Array.isArray(notifications) ? notifications : [];

  switch (filter) {
    case 'reminders':
      return list.filter((n) => isReminder(n));
    // other cases unchanged
    case 'unread':
      return list.filter((n) => !n.read);
    case 'info':
    case 'success':
    case 'warning':
    case 'error':
      return list.filter((n) => n.type === filter);
    default:
      return list;
  }
}, [notifications, filter]);


  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closePanel]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      closePanel();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="notification-overlay" onClick={closePanel} />

      {/* Panel */}
      <div className="notification-panel">
        {/* Header */}
        <div className="panel-header">
          <div className="header-title">
            <FiBell />
            <h3>Notifications</h3>
            {filteredNotifications.length > 0 && (
              <span className="notification-count">
                {filteredNotifications.length}
              </span>
            )}
          </div>
          <button
            className="btn-close"
            onClick={closePanel}
            aria-label="Close notifications"
          >
            <FiX />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="panel-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
          </button>
          <button
            className={`filter-btn ${filter === 'info' ? 'active' : ''}`}
            onClick={() => setFilter('info')}
          >
            Info
          </button>
          <button
            className={`filter-btn ${filter === 'warning' ? 'active' : ''}`}
            onClick={() => setFilter('warning')}
          >
            Warnings
          </button>
          <button
            className={`filter-btn ${filter === 'reminders' ? 'active' : ''}`}
            onClick={() => setFilter('reminders')}
          >
            Reminders
          </button>
        </div>

        {/* Actions */}
        {filteredNotifications.length > 0 && (
          <div className="panel-actions">
            <button
              className="action-btn"
              onClick={markAllAsRead}
              title="Mark all as read"
            >
              <FiCheck />
              Mark all read
            </button>
            <button
              className="action-btn danger"
              onClick={clearAll}
              title="Clear all from Unread (keep history)"
            >
              <FiTrash2 />
              Clear all
            </button>
          </div>
        )}

        {/* Notification List */}
        <div className="panel-body">
          {filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <FiBell />
              <p>No notifications</p>
              <small>You're all caught up!</small>
            </div>
          ) : (
            <div className="notification-list">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${
                    !notification.read ? 'unread' : ''
                  } ${notification.priority || ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-wrapper">
                    <NotificationIcon type={notification.type} />
                    {!notification.read && <span className="unread-dot" />}
                  </div>

                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <div className="notification-meta">
                      <span className="notification-time">
                        {formatTime(notification.createdAt)}
                      </span>
                      {notification.actionRequired && (
                        <span className="action-badge">Action Required</span>
                      )}
                    </div>
                  </div>

                  <div className="notification-actions">
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="Delete notification"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default NotificationPanel;
