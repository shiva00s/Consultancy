import { create } from 'zustand';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  filter: 'all',

  // Initialize – plug your Electron loading here later if needed
  initialize: async () => {
    console.log('Notification service initialized (stub)');
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
        return notifications.filter((n) => !n.read);
      case 'info':
      case 'success':
      case 'warning':
      case 'error':
        return notifications.filter((n) => n.type === filter);
      default:
        return notifications;
    }
  },

  // ==== REAL IMPLEMENTATIONS ====

  createNotification: async (payload) => {
    const { notifications } = get();

    const newItem = {
      id: crypto.randomUUID(),
      title: payload.title,
      message: payload.message,
      type: payload.type || 'info',        // info | success | warning | error
      priority: payload.priority || 'normal',
      createdAt: payload.createdAt || new Date().toISOString(),
      read: false,
      link: payload.link || null,
      actionRequired: !!payload.actionRequired,
    };

    const updated = [newItem, ...notifications];

    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  markAsRead: async (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );

    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  markAllAsRead: async () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));

    set({
      notifications: updated,
      unreadCount: 0,
    });
  },

  deleteNotification: async (id) => {
    const updated = get().notifications.filter((n) => n.id !== id);

    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  clearAll: async () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },
}));

export default useNotificationStore;
