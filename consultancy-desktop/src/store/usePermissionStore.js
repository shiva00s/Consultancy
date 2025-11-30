import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePermissionStore = create(
  persist(
    (set, get) => ({
      // ============================================
      // STATE
      // ============================================
      permissions: [],
      modules: [],
      menuStructure: [],
      candidateTabs: [],
      isLoaded: false,
      isLoading: false,
      error: null,
      lastLoadedUserId: null,
      lastLoadedAt: null,

      // ============================================
      // ACTIONS
      // ============================================

      /**
       * Load permissions based on user role
       */
      loadPermissions: async (user) => {
        if (!user || !user.id) {
          set({ 
            permissions: [], 
            modules: [], 
            isLoaded: false,
            lastLoadedUserId: null 
          });
          return;
        }

        // Prevent redundant loads for same user
        const currentState = get();
        if (
          currentState.isLoaded && 
          currentState.lastLoadedUserId === user.id &&
          currentState.lastLoadedAt &&
          Date.now() - currentState.lastLoadedAt < 5000 // 5 second cache
        ) {
          console.log('Permissions already loaded for user:', user.id);
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Get effective permissions based on role
          const result = await window.electronAPI.getEffectivePermissions({
            userId: user.id,
            userRole: user.role,
          });

          if (result.success) {
            set({
              permissions: result.data || [],
              modules: result.data || [],
              isLoaded: true,
              isLoading: false,
              lastLoadedUserId: user.id,
              lastLoadedAt: Date.now(),
            });

            // Load additional structures in parallel
            await Promise.all([
              get().loadMenuStructure(user),
              get().loadCandidateTabs(user)
            ]);
          } else {
            set({
              error: result.error || 'Failed to load permissions',
              isLoading: false,
              isLoaded: false,
            });
            console.error('Permission load failed:', result.error);
          }
        } catch (error) {
          console.error('Error loading permissions:', error);
          set({
            error: error.message || 'Unknown error loading permissions',
            isLoading: false,
            isLoaded: false,
          });
        }
      },

      /**
       * Load menu structure
       */
      loadMenuStructure: async (user) => {
        if (!user || !user.id) return;

        try {
          const result = await window.electronAPI.getMenuStructure({
            userRole: user.role,
            userId: user.id,
          });

          if (result.success) {
            set({ menuStructure: result.data || [] });
          } else {
            console.error('Menu structure load failed:', result.error);
          }
        } catch (error) {
          console.error('Error loading menu structure:', error);
        }
      },

      /**
       * Load candidate tabs
       */
      loadCandidateTabs: async (user) => {
        if (!user || !user.id) return;

        try {
          const result = await window.electronAPI.getCandidateTabs({
            userRole: user.role,
            userId: user.id,
          });

          if (result.success) {
            set({ candidateTabs: result.data || [] });
          } else {
            console.error('Candidate tabs load failed:', result.error);
          }
        } catch (error) {
          console.error('Error loading candidate tabs:', error);
        }
      },

      /**
       * Check if user has permission
       */
      hasPermission: (moduleKey) => {
        if (!moduleKey) return false;
        const { permissions } = get();
        return permissions.some((p) => p.module_key === moduleKey && p.is_enabled !== false);
      },

      /**
       * Check if user has any of the permissions
       */
      hasAnyPermission: (moduleKeys) => {
        if (!moduleKeys || !Array.isArray(moduleKeys)) return false;
        const { permissions } = get();
        return moduleKeys.some((key) =>
          permissions.some((p) => p.module_key === key && p.is_enabled !== false)
        );
      },

      /**
       * Check if user has all permissions
       */
      hasAllPermissions: (moduleKeys) => {
        if (!moduleKeys || !Array.isArray(moduleKeys)) return false;
        const { permissions } = get();
        return moduleKeys.every((key) =>
          permissions.some((p) => p.module_key === key && p.is_enabled !== false)
        );
      },

      /**
       * Get permissions by type
       */
      getPermissionsByType: (moduleType) => {
        const { permissions } = get();
        return permissions.filter((p) => p.module_type === moduleType && p.is_enabled !== false);
      },

      /**
       * Get menu items
       */
      getMenuItems: () => {
  const { menuStructure } = get();
  // ✅ FIX: Ensure menuStructure is always an array
  if (!Array.isArray(menuStructure)) {
    return [];
  }
  return menuStructure.filter((m) => m.is_enabled !== false);
},

      /**
       * Get submenus for a menu
       */
      getSubmenus: (parentKey) => {
        const { permissions } = get();
        return permissions.filter(
          (p) => 
            p.module_type === 'submenu' && 
            p.parent_key === parentKey &&
            p.is_enabled !== false
        );
      },

      /**
       * Get candidate tabs
       */
      getCandidateTabs: () => {
  const { candidateTabs } = get();
  // ✅ FIX: Ensure candidateTabs is always an array
  if (!Array.isArray(candidateTabs)) {
    return [];
  }
  return candidateTabs.filter((t) => t.is_enabled !== false);
},

      /**
       * Check if route is accessible
       */
      canAccessRoute: (route) => {
        // Allow home route for everyone
        if (route === '/' || route === '' || route === '/login') return true;
        
        const { permissions } = get();
        return permissions.some((p) => p.route === route && p.is_enabled !== false);
      },

      /**
       * Get accessible routes
       */
      getAccessibleRoutes: () => {
        const { permissions } = get();
        return permissions
          .filter((p) => p.route && p.is_enabled !== false)
          .map((p) => p.route);
      },

      /**
       * Refresh permissions (after changes)
       */
      refreshPermissions: async (user) => {
        // Force refresh by clearing cache
        set({ lastLoadedAt: null });
        await get().loadPermissions(user);
      },

      /**
       * Clear permissions (on logout)
       */
      clearPermissions: () => {
        set({
          permissions: [],
          modules: [],
          menuStructure: [],
          candidateTabs: [],
          isLoaded: false,
          isLoading: false,
          error: null,
          lastLoadedUserId: null,
          lastLoadedAt: null,
        });
      },

      /**
       * Toggle module (SuperAdmin only)
       */
      toggleModule: async (user, moduleKey, isEnabled) => {
        if (!user || !moduleKey) {
          return { success: false, error: 'Invalid parameters' };
        }

        try {
          const result = await window.electronAPI.toggleModule({
            user,
            moduleKey,
            isEnabled,
          });

          if (result.success) {
            // Refresh permissions
            await get().refreshPermissions(user);
            return { success: true };
          } else {
            return { success: false, error: result.error || 'Failed to toggle module' };
          }
        } catch (error) {
          console.error('Error toggling module:', error);
          return { success: false, error: error.message };
        }
      },

      /**
       * Grant permission (Admin → Staff)
       */
      grantPermission: async (user, userId, moduleKey) => {
        if (!user || !userId || !moduleKey) {
          return { success: false, error: 'Invalid parameters' };
        }

        try {
          const result = await window.electronAPI.grantPermission({
            user,
            userId,
            moduleKey,
          });

          return result;
        } catch (error) {
          console.error('Error granting permission:', error);
          return { success: false, error: error.message };
        }
      },

      /**
       * Revoke permission (Admin → Staff)
       */
      revokePermission: async (user, userId, moduleKey) => {
        if (!user || !userId || !moduleKey) {
          return { success: false, error: 'Invalid parameters' };
        }

        try {
          const result = await window.electronAPI.revokePermission({
            user,
            userId,
            moduleKey,
          });

          return result;
        } catch (error) {
          console.error('Error revoking permission:', error);
          return { success: false, error: error.message };
        }
      },

      /**
       * Bulk update permissions (Admin → Staff)
       */
      bulkUpdatePermissions: async (user, userId, moduleKeys) => {
        if (!user || !userId || !Array.isArray(moduleKeys)) {
          return { success: false, error: 'Invalid parameters' };
        }

        try {
          const result = await window.electronAPI.bulkUpdatePermissions({
            user,
            userId,
            moduleKeys,
          });

          return result;
        } catch (error) {
          console.error('Error bulk updating permissions:', error);
          return { success: false, error: error.message };
        }
      },
    }),
    {
      name: 'permission-storage',
      version: 2, // ✅ Incremented version
      partialize: (state) => ({
        // Only persist essential data
        permissions: state.permissions,
        modules: state.modules,
        menuStructure: state.menuStructure,
        candidateTabs: state.candidateTabs,
        isLoaded: state.isLoaded,
        lastLoadedUserId: state.lastLoadedUserId,
        lastLoadedAt: state.lastLoadedAt,
      }),
      // ✅ MIGRATION FUNCTION - This fixes the warning!
      migrate: (persistedState, version) => {
        // If no version or version < 2, reset to default state
        if (version < 2) {
          console.log('Migrating permission store from version', version, 'to 2');
          return {
            permissions: [],
            modules: [],
            menuStructure: [],
            candidateTabs: [],
            isLoaded: false,
            lastLoadedUserId: null,
            lastLoadedAt: null,
          };
        }
        // Otherwise return persisted state
        return persistedState;
      },
    }
  )
);

export default usePermissionStore;
