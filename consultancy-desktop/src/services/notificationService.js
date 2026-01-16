import { sanitizeText } from '../utils/sanitize';
import useAuthStore from '../store/useAuthStore';

class NotificationService {
  constructor() {
    this.notifications = [];
    this.listeners = [];
    this.unreadCount = 0;
    this.enabled = false;
  }

  async initialize() {
    try {
      const api = window.electronAPI;

      if (!api) {
        console.warn('Notification service disabled - Electron API not available');
        this.enabled = false;
        return;
      }

      this.enabled = true;

      // Prompt for desktop notification permission once (developer-friendly)
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          const granted = await this.requestPermission();
          if (granted) console.log('Desktop notification permission granted');
        }
      } catch (permErr) {
        console.warn('Requesting notification permission failed', permErr);
      }

      if (typeof api.getNotifications === 'function') {
        await this.loadNotifications();
      }

      if (typeof api.checkReminders === 'function') {
        await this.checkReminders();
        setInterval(() => this.checkReminders(), 60000);
      }

      if (typeof api.onNotification === 'function') {
        api.onNotification((notification) => {
          this.addNotification(notification);
        });
      }
    } catch (error) {
      console.error('Error initializing notification service:', error);
      this.enabled = false;
    }
  }

  async loadNotifications(limit = 50) {
    if (!this.enabled) return;

    try {
      const result = await window.electronAPI.getNotifications({ limit });

      if (result?.success && Array.isArray(result.notifications)) {
        this.notifications = result.notifications;
        this.unreadCount = result.notifications.filter((n) => !n.read).length;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  async markAsRead(notificationId) {
    if (!this.enabled) return;

    try {
      const result = await window.electronAPI.markNotificationAsRead({ notificationId });

      if (result?.success) {
        const notification = this.notifications.find((n) => n.id === notificationId);
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

  async markAllAsRead() {
    if (!this.enabled) return;

    try {
      const result = await window.electronAPI.markAllNotificationsAsRead();

      if (result?.success) {
        this.notifications.forEach((n) => {
          n.read = true;
        });
        this.unreadCount = 0;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  async deleteNotification(notificationId) {
    if (!this.enabled) return;

    try {
      const result = await window.electronAPI.deleteNotification({ notificationId });

      if (result?.success) {
        const index = this.notifications.findIndex((n) => n.id === notificationId);
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

  async clearAll() {
    if (!this.enabled) return;
    try {
      const result = await window.electronAPI.clearAllNotifications();
      if (result?.success) {
        await this.loadNotifications(); // reload from DB, all read now
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  async createNotification(data) {
    if (!this.enabled) {
      const localNotification = {
        id: Date.now(),
        title: sanitizeText(data.title),
        message: sanitizeText(data.message),
        type: data.type || 'info',
        priority: data.priority || 'normal',
        link: data.link || null,
        candidateId: data.candidateId || null,
        actionRequired: !!data.actionRequired,
        createdAt: new Date().toISOString(),
        read: false,
      };
      this.addNotification(localNotification);
      return { success: true, notification: localNotification };
    }

    try {
      const sanitizedData = {
        title: sanitizeText(data.title),
        message: sanitizeText(data.message),
        type: data.type,
        priority: data.priority || 'normal',
        link: data.link || null,
        candidateId: data.candidateId || null,
        actionRequired: !!data.actionRequired,
        // Optional richer fields: actor, target, meta
        actorId: data.actorId || (data.actor && data.actor.id) || null,
        actorName: data.actorName || (data.actor && data.actor.name) || (data.actor && data.actor.username) || null,
        targetType: data.targetType || (data.target && data.target.type) || null,
        targetId: data.targetId || (data.target && data.target.id) || null,
        // Build a normalized meta payload so UI can reliably display details
        meta: Object.assign(
          {},
          data.meta || {},
          // common fields used across modules
          {
            who: (data.actor && (data.actor.name || data.actor.username)) || data.actorName || null,
            where: data.place || data.location || data.send_to || data.received_from || null,
            how: data.method || null,
            when: data.when || data.timestamp || data.date || data.created_at || null,
            name: data.name || data.send_to_name || data.send_to_contact_name || null,
            id: data.id || data.targetId || (data.target && data.target.id) || null,
            contact: data.contact || data.send_to_contact || data.send_to_contact_number || null,
          }
        ),
        category: data.category || data.type || null,
      };

      // If actor info not provided, pick from current authenticated user (if available)
      try {
        const currentUser = useAuthStore.getState().user;
        if (!sanitizedData.actorId && currentUser) {
          sanitizedData.actorId = currentUser.id || null;
        }
        if (!sanitizedData.actorName && currentUser) {
          sanitizedData.actorName = currentUser.companyName || currentUser.name || currentUser.username || null;
        }
      } catch (e) {
        // ignore if store not available
      }

      const result = await window.electronAPI.createNotification(sanitizedData);

      if (result?.success && result.notification) {
        this.addNotification(result.notification);
      }

      return result;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // showDesktopNotification REMOVED

  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  // In NotificationService.js
async checkReminders() {
  if (!this.enabled) return;
  if (typeof window.electronAPI.checkReminders !== 'function') return;

  try {
    const result = await window.electronAPI.checkReminders();

    if (result?.success && Array.isArray(result.reminders) && result.reminders.length > 0) {
      result.reminders.forEach((reminder) => {
        this.createNotification({
          title: `Reminder: ${reminder.title}`,
          message: reminder.message,
          type: 'reminder',          // mark as reminder
          category: 'reminder',      // extra flag used by panel
          priority: reminder.priority || 'high',
          link: reminder.link || null,
          candidateId: reminder.candidateId || null,
          actionRequired: true,
        });
      });
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}


  addNotification(notification) {
    this.notifications.unshift(notification);
    if (!notification.read) {
      this.unreadCount += 1;
    }
    this.notifyListeners();
    // show a desktop notification when permission granted
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title = notification.title || 'Notification';
        const body = notification.message || '';
        try {
          const n = new Notification(title, { body });
          n.onclick = () => {
            try {
              if (window && window.focus) window.focus();
            } catch (e) {}
          };
        } catch (e) {
          console.warn('Failed to show desktop notification', e);
        }
      }
    } catch (err) {
      console.warn('Desktop notification check failed', err);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notifyListeners() {
    const payload = {
      notifications: this.notifications,
      unreadCount: this.unreadCount,
    };
    this.listeners.forEach((callback) => callback(payload));
  }

  getByType(type) {
    return this.notifications.filter((n) => n.type === type);
  }

  getUnread() {
    return this.notifications.filter((n) => !n.read);
  }
}

export const notificationService = new NotificationService();
