import { sanitizeText } from '../utils/sanitize';

class NotificationService {
  constructor() {
    this.notifications = [];
    this.listeners = [];
    this.unreadCount = 0;
    this.enabled = false;
  }

  async initialize() {
    try {
      // Check if Electron API exists
      if (!window.electronAPI || typeof window.electronAPI.getNotifications !== 'function') {
        console.warn('Notification service disabled - Electron API not available');
        this.enabled = false;
        return;
      }

      this.enabled = true;
      await this.loadNotifications();

      // Setup real-time notification listener
      if (window.electronAPI.onNotification) {
        window.electronAPI.onNotification((notification) => {
          this.addNotification(notification);
        });
      }

      // Check for reminders every minute
      setInterval(() => this.checkReminders(), 60000);
    } catch (error) {
      console.error('Error initializing notification service:', error);
      this.enabled = false;
    }
  }

  async loadNotifications(limit = 50) {
    if (!this.enabled) return;
    
    try {
      const result = await window.electronAPI.getNotifications({ limit });
      
      if (result.success) {
        this.notifications = result.notifications;
        this.unreadCount = result.notifications.filter(n => !n.read).length;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      const result = await window.electronAPI.markNotificationAsRead({ notificationId });
      
      if (result.success) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
          notification.read = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const result = await window.electronAPI.markAllNotificationsAsRead();
      
      if (result.success) {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId) {
    try {
      const result = await window.electronAPI.deleteNotification({ notificationId });
      
      if (result.success) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
          const notification = this.notifications[index];
          if (!notification.read) {
            this.unreadCount = Math.max(0, this.unreadCount - 1);
          }
          this.notifications.splice(index, 1);
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAll() {
    try {
      const result = await window.electronAPI.clearAllNotifications();
      
      if (result.success) {
        this.notifications = [];
        this.unreadCount = 0;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Create notification
   */
  async createNotification(data) {
    try {
      const sanitizedData = {
        title: sanitizeText(data.title),
        message: sanitizeText(data.message),
        type: data.type, // info, success, warning, error
        priority: data.priority || 'normal', // low, normal, high, urgent
        link: data.link || null,
        candidateId: data.candidateId || null,
        actionRequired: data.actionRequired || false,
      };

      const result = await window.electronAPI.createNotification(sanitizedData);
      
      if (result.success) {
        this.addNotification(result.notification);
      }

      return result;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Show desktop notification
   */
  showDesktopNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon.png',
        tag: notification.id,
      });
    }
  }

  /**
   * Request desktop notification permission
   */
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Check for upcoming reminders
   */
  async checkReminders() {
    try {
      const result = await window.electronAPI.checkReminders();
      
      if (result.success && result.reminders.length > 0) {
        result.reminders.forEach(reminder => {
          this.createNotification({
            title: `Reminder: ${reminder.title}`,
            message: reminder.message,
            type: 'warning',
            priority: 'high',
            link: reminder.link,
            actionRequired: true,
          });
        });
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }

  /**
   * Subscribe to notification updates
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      callback({
        notifications: this.notifications,
        unreadCount: this.unreadCount,
      });
    });
  }

  /**
   * Get notifications by type
   */
  getByType(type) {
    return this.notifications.filter(n => n.type === type);
  }

  /**
   * Get unread notifications
   */
  getUnread() {
    return this.notifications.filter(n => !n.read);
  }
}

export const notificationService = new NotificationService();
// Phone number: E.164 format
// Optional, can be empty string