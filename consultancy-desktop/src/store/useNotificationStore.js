import { create } from 'zustand';
import { notificationService } from '../services/notificationService';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  filter: 'all', // 'all' | 'unread' | 'info' | 'warning' | 'reminders'

  // Panel controls
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  togglePanel: () => {
    const current = get().isOpen;
    set({ isOpen: !current });
  },

  // Backward‑compat alias for old code
  closePanel: () => {
    set({ isOpen: false });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  // Initialization: load from service and subscribe
  initialize: async () => {
    try {
      await notificationService.initialize();
      set({
        notifications: notificationService.notifications || [],
        unreadCount: notificationService.unreadCount || 0,
      });

      notificationService.subscribe(({ notifications, unreadCount }) => {
        set({
          notifications: notifications || [],
          unreadCount: unreadCount || 0,
        });
      });
    } catch (err) {
      console.error('Notification store initialize failed', err);
    }
  },

  // Notification actions
  createNotification: async (data) => {
    try {
      return await notificationService.createNotification(data);
    } catch (err) {
      console.error('createNotification store failed', err);
      throw err;
    }
  },

  markAsRead: async (id) => {
    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.error('markAsRead store failed', err);
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.error('markAllAsRead store failed', err);
    }
  },

  deleteNotification: async (id) => {
    try {
      await notificationService.deleteNotification(id);
    } catch (err) {
      console.error('deleteNotification store failed', err);
    }
  },

  // Clear all = mark all as read (no delete)
  clearAll: async () => {
    try {
      await notificationService.clearAll();
    } catch (err) {
      console.error('clearAll store failed', err);
    }
  },
}));

export default useNotificationStore;
