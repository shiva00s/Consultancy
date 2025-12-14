// FILE: src/store/usePermissionStore.js
// REPLACE ENTIRE FILE

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
      
      // NEW: Granular permission cache
      granularPermissions: {},
      roleHierarchy: {
        super_admin: 100,
        admin: 50,
        staff: 10,
      },

      // ============================================
      // ACTIONS
      // ============================================

      /**
       * Load permissions based on user role with enhanced granularity
       */
      loadPermissions: async (user) => {
        if (!user || !user.id) {
          set({ 
            permissions: [], 
            modules: [], 
            granularPermissions: {},
            isLoaded: false,
            lastLoadedUserId: null 
          });
          return;
        }

        const currentState = get();
        if (
          currentState.isLoaded && 
          currentState.lastLoadedUserId === user.id &&
          currentState.lastLoadedAt &&
          Date.now() - currentState.lastLoadedAt < 5000
        ) {
          console.log('Permissions already loaded for user:', user.id);
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Get effective permissions with CRUD breakdown
          const result = await window.electronAPI.getEffectivePermissions({
            userId: user.id,
            userRole: user.role,
            includeGranular: true, // NEW: Request CRUD-level permissions
          });

          if (result.success) {
            set({
              permissions: result.data || [],
              modules: result.data || [],
              granularPermissions: result.granular || {},
              isLoaded: true,
              isLoading: false,
              lastLoadedUserId: user.id,
              lastLoadedAt: Date.now(),
            });

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
       * NEW: Check CRUD-level permission
       * @param {string} moduleKey - Module identifier
       * @param {string} action - 'create', 'read', 'update', 'delete', 'export', 'import'
       * @returns {boolean}
       */
      hasPermission: (moduleKey, action = 'read') => {
        if (!moduleKey) return false;
        
        const { granularPermissions, permissions } = get();
        
        // If granular permissions exist, check action-level
        if (granularPermissions[moduleKey]) {
          return granularPermissions[moduleKey][action] === true;
        }
        
        // Fallback to module-level check
        return permissions.some((p) => p.module_key === moduleKey && p.is_enabled !== false);
      },

      /**
       * NEW: Check multiple action permissions for a module
       */
      hasPermissions: (moduleKey, actions = []) => {
        if (!moduleKey || !actions.length) return false;
        
        const results = {};
        actions.forEach(action => {
          results[action] = get().hasPermission(moduleKey, action);
        });
        
        return results;
      },

      /**
       * Check if user has any of the module permissions
       */
      hasAnyPermission: (moduleKeys) => {
        if (!moduleKeys || !Array.isArray(moduleKeys)) return false;
        const { permissions } = get();
        return moduleKeys.some((key) =>
          permissions.some((p) => p.module_key === key && p.is_enabled !== false)
        );
      },

      /**
       * Check if user has all module permissions
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
        if (!Array.isArray(candidateTabs)) {
          return [];
        }
        return candidateTabs.filter((t) => t.is_enabled !== false);
      },

      /**
       * Check if route is accessible
       */
      canAccessRoute: (route) => {
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
       * NEW: Check if user can perform action based on role hierarchy
       */
      canPerformAction: (actorUser, targetUser, action) => {
        const { roleHierarchy } = get();
        const actorLevel = roleHierarchy[actorUser.role] || 0;
        const targetLevel = roleHierarchy[targetUser.role] || 0;
        
        // Can only modify users below you in hierarchy
        if (action === 'modify' || action === 'delete') {
          return actorLevel > targetLevel;
        }
        
        // Can view users at same level or below
        if (action === 'view') {
          return actorLevel >= targetLevel;
        }
        
        return false;
      },

      /**
       * Refresh permissions (after changes)
       */
      refreshPermissions: async (user) => {
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
          granularPermissions: {},
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
       * NEW: Grant granular permission (SuperAdmin → Admin, Admin → Staff)
       */
      grantGranularPermission: async (user, userId, moduleKey, actions) => {
        if (!user || !userId || !moduleKey || !actions) {
          return { success: false, error: 'Invalid parameters' };
        }

        try {
          const result = await window.electronAPI.grantGranularPermission({
            user,
            userId,
            moduleKey,
            actions, // { create: true, read: true, update: false, delete: false }
          });

          if (result.success) {
            await get().refreshPermissions(user);
          }

          return result;
        } catch (error) {
          console.error('Error granting granular permission:', error);
          return { success: false, error: error.message };
        }
      },

      /**
       * Grant permission (Admin → Staff) - Legacy support
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

      /**
       * NEW: Get permission summary for user
       */
      getPermissionSummary: (userId) => {
        const { permissions, granularPermissions } = get();
        
        return {
          totalModules: permissions.length,
          enabledModules: permissions.filter(p => p.is_enabled).length,
          granularBreakdown: Object.keys(granularPermissions).reduce((acc, key) => {
            const perms = granularPermissions[key];
            acc[key] = {
              create: perms.create || false,
              read: perms.read || false,
              update: perms.update || false,
              delete: perms.delete || false,
              export: perms.export || false,
              import: perms.import || false,
            };
            return acc;
          }, {}),
        };
      },
    }),
    {
      name: 'permission-storage',
      version: 3, // Incremented for new granular permissions
      partialize: (state) => ({
        permissions: state.permissions,
        modules: state.modules,
        menuStructure: state.menuStructure,
        candidateTabs: state.candidateTabs,
        granularPermissions: state.granularPermissions,
        isLoaded: state.isLoaded,
        lastLoadedUserId: state.lastLoadedUserId,
        lastLoadedAt: state.lastLoadedAt,
      }),
      migrate: (persistedState, version) => {
        if (version < 3) {
          console.log('Migrating permission store from version', version, 'to 3');
          return {
            permissions: [],
            modules: [],
            menuStructure: [],
            candidateTabs: [],
            granularPermissions: {},
            isLoaded: false,
            lastLoadedUserId: null,
            lastLoadedAt: null,
          };
        }
        return persistedState;
      },
    }
  )
);

export default usePermissionStore;
