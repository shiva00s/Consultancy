import { create } from "zustand";

const getInitialUser = () => {
  const userJson = sessionStorage.getItem("user");
  return userJson ? JSON.parse(userJson) : null;
};

const getInitialFlags = () => {
  const flagsJson = sessionStorage.getItem("featureFlags");
  return flagsJson ? JSON.parse(flagsJson) : null;
};

const useAuthStore = create((set, get) => ({
  user: getInitialUser(),
  featureFlags: getInitialFlags(),
  isAuthenticated: !!getInitialUser(),

  login: async (userData, fetchInitialData) => {
    try {
      sessionStorage.setItem("user", JSON.stringify(userData));
      set({ user: userData, isAuthenticated: true });

      let finalFlags = {};

      if (userData.role === "super_admin") {
        const res = await window.electronAPI.invoke('get-feature-flags');
        finalFlags = res?.data || {};
      } else if (userData.role === "admin") {
        const [globalRes, adminRes] = await Promise.all([
          window.electronAPI.invoke('get-feature-flags'),
          window.electronAPI.invoke('get-admin-assigned-features', { userId: userData.id })
        ]);

        const globalFlags = globalRes?.data || {};
        const adminAssignedFeatures = adminRes?.data || {};

        finalFlags = {};
        Object.keys(globalFlags).forEach((key) => {
          finalFlags[key] = globalFlags[key] && adminAssignedFeatures[key];
        });
      } else if (userData.role === "staff") {
        if (!userData.adminId) {
          console.warn('Staff user has no admin assigned, using empty flags');
          finalFlags = {};
        } else {
          const [adminRes, userRes] = await Promise.all([
            window.electronAPI.invoke('get-admin-effective-flags', { adminId: userData.adminId }),
            window.electronAPI.invoke('get-user-permissions', { userId: userData.id })
          ]);

          const adminEffectiveFlags = adminRes?.data || {};
          const userOverrides = userRes?.data || {};

          finalFlags = { ...adminEffectiveFlags };

          Object.keys(userOverrides).forEach((key) => {
            if (adminEffectiveFlags[key]) {
              finalFlags[key] = userOverrides[key];
            } else {
              finalFlags[key] = false;
            }
          });
        }
      }

      sessionStorage.setItem('featureFlags', JSON.stringify(finalFlags));
      set({ featureFlags: finalFlags });

      if (fetchInitialData) {
        await fetchInitialData();
      }

      return { success: true };
    } catch (err) {
      console.error("Failed to fetch feature flags/permissions:", err);
      set({ featureFlags: {} });
      return { success: false, error: err.message };
    }
  },

  logout: () => {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("featureFlags");
    set({ user: null, featureFlags: null, isAuthenticated: false });
  },

  refreshFlags: async () => {
    console.log("Refreshing feature flags...");
    try {
      const res = await window.electronAPI.invoke('get-feature-flags');
      if (res.success) {
        const newFlags = res.data;
        sessionStorage.setItem("featureFlags", JSON.stringify(newFlags));
        set({ featureFlags: newFlags });
      }
    } catch (err) {
      console.error("Failed to fetch feature flags:", err);
    }
  },

  updateUser: (userData) => {
    const currentUser = get().user;
    const updatedUser = { ...currentUser, ...userData };
    sessionStorage.setItem("user", JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  isSessionValid: () => {
    const { user, isAuthenticated } = get();
    return isAuthenticated && user && user.id;
  },
}));

export default useAuthStore;
