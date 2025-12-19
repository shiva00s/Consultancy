import { create } from "zustand";

// Helper to get initial state from sessionStorage
const getInitialUser = () => {
  const userJson = sessionStorage.getItem("user");
  return userJson ? JSON.parse(userJson) : null;
};

const getInitialFlags = () => {
  const flagsJson = sessionStorage.getItem("featureFlags");
  return flagsJson ? JSON.parse(flagsJson) : null;
};

const fetchAdminFeatures = async (user) => {
  try {
    const res = await window.electronAPI.getAdminAssignedFeatures({
      userId: user.id,
    });
    if (res.success) {
      set({ featureFlags: res.features });
    } else {
      console.error("Failed to fetch features:", res.error);
    }
  } catch (err) {
    console.error("Failed to fetch features:", err);
  }
};



const useAuthStore = create((set, get) => ({
  user: getInitialUser(),
  featureFlags: getInitialFlags(),
  isAuthenticated: !!getInitialUser(),

  login: async (userData, fetchInitialData) => {
    sessionStorage.setItem("user", JSON.stringify(userData));
    set({ user: userData, isAuthenticated: true });

    try {
      let finalFlags = {};

      if (userData.role === "super_admin") {
        // 1. Super Admin: Get Global Flags directly
        finalFlags = (await window.electronAPI.getFeatureFlags()).data || {};
      } else if (userData.role === "admin") {
        // 2. Admin: Get flags specifically assigned by Superadmin,
        //    then intersect with global flags (the ceiling)
        const globalFlags =
          (await window.electronAPI.getFeatureFlags()).data || {};
        const adminAssignedFeaturesRes =
          await window.electronAPI.getAdminAssignedFeatures({
            userId: userData.id,
          });
        const adminAssignedFeatures = adminAssignedFeaturesRes.data || {};

        finalFlags = {};
        Object.keys(globalFlags).forEach((key) => {
          // Feature is enabled for admin if globally enabled AND assigned by superadmin
          finalFlags[key] = globalFlags[key] && adminAssignedFeatures[key];
        });
      } else if (userData.role === "staff") {
        // 3. Staff: Merge Admin's policy (which is derived from Global + Superadmin assignment) + User Overrides

        // A. Get Admin's Effective Flags (The Ceiling for Staff)
        //    This assumes the logged-in user's direct admin's ID is available.
        //    For simplicity, here we'll assume staff gets flags from their immediate 'parent' admin
        //    If a staff member doesn't have a direct admin assigned, they might fall back to global flags
        //    or a restricted default set. For now, let's assume `userData` has `adminId`.
        //    FIXME: If userData.adminId is not available, this logic needs adjustment.
        const adminEffectiveFlagsRes =
          await window.electronAPI.getAdminEffectiveFlags({
            adminId: userData.adminId,
          });
        const adminEffectiveFlags = adminEffectiveFlagsRes.data || {};

        // B. Get User Specific Overrides (The Assignment from Admin)
        const userPermsRes = await window.electronAPI.getUserPermissions({
          userId: userData.id,
        });
        const userOverrides = userPermsRes.data || {};

        // C. Merge: Only enable if enabled by Admin AND enabled for Staff
        finalFlags = { ...adminEffectiveFlags };

        Object.keys(userOverrides).forEach((key) => {
          if (adminEffectiveFlags[key]) {
            // Only apply override if enabled by Admin
            finalFlags[key] = userOverrides[key];
          } else {
            // If admin has it disabled, force disabled for staff
            finalFlags[key] = false;
          }
        });
      }

      sessionStorage.setItem('featureFlags', JSON.stringify(finalFlags));
      set(state => ({ ...state, featureFlags: finalFlags }));

      if (fetchInitialData) {
        fetchInitialData();
      }
    } catch (err) {
      console.error("Failed to fetch feature flags/permissions:", err);
      set({ featureFlags: {} });
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
      const res = await window.electronAPI.getFeatureFlags();
      if (res.success) {
        const newFlags = res.data;
        sessionStorage.setItem("featureFlags", JSON.stringify(newFlags));
        set({ featureFlags: newFlags });
      }
    } catch (err) {
      console.error("Failed to fetch feature flags:", err);
    }
  },
}));

export default useAuthStore;
