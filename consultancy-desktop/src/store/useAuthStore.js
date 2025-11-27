import { create } from 'zustand';

// Helper to get initial state from sessionStorage
const getInitialUser = () => {
  const userJson = sessionStorage.getItem('user');
  return userJson ? JSON.parse(userJson) : null;
};

const getInitialFlags = () => {
  const flagsJson = sessionStorage.getItem('featureFlags');
  return flagsJson ? JSON.parse(flagsJson) : null;
};

const useAuthStore = create((set, get) => ({
  user: getInitialUser(),
  featureFlags: getInitialFlags(),
  isAuthenticated: !!getInitialUser(),

  login: async (userData, fetchInitialData) => {
    sessionStorage.setItem('user', JSON.stringify(userData));
    set({ user: userData, isAuthenticated: true });

    try {
      let finalFlags = {};

      if (userData.role === 'super_admin') {
          // 1. Super Admin: Get Global Flags directly
          finalFlags = (await window.electronAPI.getFeatureFlags()).data || {};
          
      } else if (userData.role === 'admin') {
          // 2. Admin: Inherit Global Flags directly
          finalFlags = (await window.electronAPI.getFeatureFlags()).data || {};
          
      } else if (userData.role === 'staff') {
          // 3. Staff: Merge Global Policy + User Overrides
          
          // A. Get Global Flags (The Ceiling)
          const globalFlags = (await window.electronAPI.getFeatureFlags()).data || {}; 

          // B. Get User Specific Overrides (The Assignment)
          const userPermsRes = await window.electronAPI.getUserPermissions({ userId: userData.id });
          const userOverrides = userPermsRes.data || {};

          // C. Merge: Only enable if enabled Globally AND enabled for Staff
          finalFlags = { ...globalFlags }; 
          
          Object.keys(userOverrides).forEach(key => {
              if (globalFlags[key]) { 
                  // Only apply override if globally enabled
                  finalFlags[key] = userOverrides[key]; 
              } else {
                  // If globally disabled, force disabled for staff
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
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('featureFlags');
    set({ user: null, featureFlags: null, isAuthenticated: false });
  },

  refreshFlags: async () => {
    console.log("Refreshing feature flags...");
    try {
      const res = await window.electronAPI.getFeatureFlags();
      if (res.success) {
        const newFlags = res.data;
        sessionStorage.setItem('featureFlags', JSON.stringify(newFlags));
        set({ featureFlags: newFlags });
      }
    } catch (err) {
      console.error("Failed to fetch feature flags:", err);
    }
  },
}));

export default useAuthStore;