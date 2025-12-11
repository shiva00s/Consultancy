import { create } from 'zustand';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  filter: 'all',

  // Stub initialize - does nothing
  initialize: async () => {
    console.log('Notification service disabled - Electron API not available');
  },

  togglePanel: () => {
    set({ isOpen: !get().isOpen });
  },

  closePanel: () => {
    set({ isOpen: false });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  getFilteredNotifications: () => {
    const { notifications, filter } = get();
    
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'info':
      case 'success':
      case 'warning':
      case 'error':
        return notifications.filter(n => n.type === filter);
      default:
        return notifications;
    }
  },

  // Stub methods - do nothing
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  clearAll: async () => {},
  createNotification: async () => {},
}));

export default useNotificationStore;
