const { ipcMain } = require('electron');
const { getDatabase } = require('../../db/database.cjs');

/**
 * Complete Menu Configuration - Matches Your Structure
 */
const MENU_CONFIG = [
  {
    module_key: 'dashboard',
    module_name: 'Dashboard',
    icon: 'FiHome',
    route: '/',
    module_type: 'menu',
    display_order: 1,
    is_enabled: true
  },
  {
    module_key: 'candidates',
    module_name: 'Candidates',
    icon: 'FiUsers',
    module_type: 'menu',
    display_order: 2,
    is_enabled: true,
    submenus: [
      { 
        module_key: 'candidate_search', 
        module_name: 'Candidate Search', 
        icon: 'FiSearch', 
        route: '/search',
        display_order: 1 
      },
      { 
        module_key: 'add_new_candidate', 
        module_name: 'Add New Candidate', 
        icon: 'FiUserPlus', 
        route: '/add',
        display_order: 2 
      },
      { 
        module_key: 'bulk_import', 
        module_name: 'Bulk Import', 
        icon: 'FiUpload', 
        route: '/import',
        display_order: 3 
      }
    ]
  },
  {
    module_key: 'management',
    module_name: 'Management',
    icon: 'FiBriefcase',
    module_type: 'menu',
    display_order: 3,
    is_enabled: true,
    submenus: [
      { 
        module_key: 'employers', 
        module_name: 'Employers', 
        icon: 'FiBriefcase', 
        route: '/employers',
        display_order: 1 
      },
      { 
        module_key: 'job_orders', 
        module_name: 'Job Orders', 
        icon: 'FiClipboard', 
        route: '/jobs',
        display_order: 2 
      },
      { 
        module_key: 'visa_board', 
        module_name: 'Visa Board', 
        icon: 'FiGlobe', 
        route: '/visa-board',
        display_order: 3 
      }
    ]
  },
  {
    module_key: 'reports',
    module_name: 'Reports',
    icon: 'FiBarChart2',
    module_type: 'menu',
    display_order: 4,
    is_enabled: true,
    submenus: [
      { 
        module_key: 'advanced_reports', 
        module_name: 'Advanced Reports', 
        icon: 'FiBarChart2', 
        route: '/reports',
        display_order: 1 
      },
      { 
        module_key: 'analytics_reports', 
        module_name: 'Analytics Reports', 
        icon: 'FiActivity', 
        route: '/reports/analytics',
        display_order: 2 
      }
    ]
  },
  {
    module_key: 'system_settings',
    module_name: 'System Settings',
    icon: 'FiSettings',
    module_type: 'menu',
    display_order: 5,
    is_enabled: true,
    submenus: [
      { 
        module_key: 'audit_log', 
        module_name: 'Audit Log', 
        icon: 'FiActivity', 
        route: '/system-audit',
        display_order: 1 
      },
      { 
        module_key: 'modules', 
        module_name: 'Modules', 
        icon: 'FiGrid', 
        route: '/system-modules',
        display_order: 2 
      },
      { 
        module_key: 'settings', 
        module_name: 'Settings', 
        icon: 'FiSettings', 
        route: '/settings',
        display_order: 3 
      },
      { 
        module_key: 'recycle_bin', 
        module_name: 'Recycle Bin', 
        icon: 'FiTrash2', 
        route: '/recycle-bin',
        display_order: 4 
      }
    ]
  }
];

/**
 * Get all module keys (including submenus) as a flat list
 */
function getAllModuleKeys() {
  const keys = [];
  MENU_CONFIG.forEach(menu => {
    keys.push(menu.module_key);
    if (menu.submenus) {
      menu.submenus.forEach(sub => keys.push(sub.module_key));
    }
  });
  return keys;
}

/**
 * Register all permission-related IPC handlers
 */
function registerPermissionHandlers() {
  const db = getDatabase();

  // ============================================
  // GET EFFECTIVE PERMISSIONS
  // ============================================
  ipcMain.handle('permission:getEffectivePermissions', async (event, args) => {
    try {
      const { userId, userRole } = args;

      if (!userId || !userRole) {
        return {
          success: false,
          error: 'Missing userId or userRole'
        };
      }

      let permissions = [];

      if (userRole === 'super_admin') {
        // SuperAdmin: Get ALL features
        permissions = await new Promise((resolve, reject) => {
          db.all('SELECT key as module_key, name, description FROM features ORDER BY key ASC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });

      } else if (userRole === 'admin') {
        // Admin: Get features enabled by SuperAdmin
        permissions = await new Promise((resolve, reject) => {
          db.all(`
            SELECT f.key as module_key, f.name, f.description, COALESCE(t.enabled, 1) as is_enabled
            FROM features f
            LEFT JOIN superadmin_admin_feature_toggles t ON f.key = t.feature_key
            WHERE COALESCE(t.enabled, 1) = 1
            ORDER BY f.key ASC
          `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });

      } else if (userRole === 'staff') {
        // Staff: Get features assigned by Admin
        permissions = await new Promise((resolve, reject) => {
          db.all(`
            SELECT f.key as module_key, f.name, f.description, a.enabled as is_enabled
            FROM features f
            INNER JOIN admin_staff_feature_assignments a ON f.key = a.feature_key
            WHERE a.staff_id = ? AND a.enabled = 1
            ORDER BY f.key ASC
          `, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      }

      return {
        success: true,
        data: permissions
      };

    } catch (error) {
      console.error('Error getting effective permissions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // GET MENU STRUCTURE
  // ============================================
  ipcMain.handle('permission:getMenuStructure', async (event, args) => {
    try {
      const { userId, userRole } = args;

      // Get user's permission keys
      let userPermissions = [];
      
      if (userRole === 'super_admin') {
        // SuperAdmin sees everything
        userPermissions = getAllModuleKeys();
        
      } else {
        // Get from database
        const dbPerms = await new Promise((resolve, reject) => {
          if (userRole === 'admin') {
            db.all(`
              SELECT f.key
              FROM features f
              LEFT JOIN superadmin_admin_feature_toggles t ON f.key = t.feature_key
              WHERE COALESCE(t.enabled, 1) = 1
            `, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          } else {
            db.all(`
              SELECT f.key
              FROM features f
              INNER JOIN admin_staff_feature_assignments a ON f.key = a.feature_key
              WHERE a.staff_id = ? AND a.enabled = 1
            `, [userId], (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          }
        });
        userPermissions = dbPerms.map(p => p.key);
      }

      // Filter menus based on permissions
      const filteredMenus = MENU_CONFIG
        .filter(menu => userPermissions.includes(menu.module_key))
        .map(menu => {
          const menuCopy = { ...menu };
          
          // Filter submenus if they exist
          if (menuCopy.submenus) {
            menuCopy.submenus = menuCopy.submenus
              .filter(sub => userPermissions.includes(sub.module_key))
              .sort((a, b) => a.display_order - b.display_order);
          }
          
          return menuCopy;
        })
        .sort((a, b) => a.display_order - b.display_order);

      return {
        success: true,
        data: filteredMenus
      };

    } catch (error) {
      console.error('Error getting menu structure:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // GET CANDIDATE TABS
  // ============================================
  ipcMain.handle('permission:getCandidateTabs', async (event, args) => {
    try {
      const { userId, userRole } = args;

      // Candidate tabs configuration
      const TAB_CONFIG = [
        { module_key: 'profile', module_name: 'Profile', icon: 'FiUser', display_order: 1 },
        { module_key: 'passport_tracking', module_name: 'Passport', icon: 'FiClipboard', display_order: 2 },
        { module_key: 'documents', module_name: 'Documents', icon: 'FiInbox', display_order: 3 },
        { module_key: 'job_placements', module_name: 'Jobs', icon: 'FiBriefcase', display_order: 4 },
        { module_key: 'visa_tracking', module_name: 'Visa', icon: 'FiGlobe', display_order: 5 },
        { module_key: 'financial_tracking', module_name: 'Finance', icon: 'FiDollarSign', display_order: 6 },
        { module_key: 'medical', module_name: 'Medical', icon: 'FiActivity', display_order: 7 },
        { module_key: 'interview_schedule', module_name: 'Interview', icon: 'FiCalendar', display_order: 8 },
        { module_key: 'travel_tickets', module_name: 'Travel', icon: 'FiTruck', display_order: 9 },
        { module_key: 'offer_letter', module_name: 'Offer', icon: 'FiMail', display_order: 10 },
        { module_key: 'history', module_name: 'History', icon: 'FiClock', display_order: 11 }
      ];

      let userPermissions = [];

      if (userRole === 'super_admin') {
        // SuperAdmin sees all tabs
        userPermissions = TAB_CONFIG.map(t => t.module_key);
      } else {
        // Get from database
        const dbPerms = await new Promise((resolve, reject) => {
          if (userRole === 'admin') {
            db.all(`
              SELECT f.key
              FROM features f
              LEFT JOIN superadmin_admin_feature_toggles t ON f.key = t.feature_key
              WHERE COALESCE(t.enabled, 1) = 1
                AND f.key IN (${TAB_CONFIG.map(() => '?').join(',')})
            `, TAB_CONFIG.map(t => t.module_key), (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          } else {
            db.all(`
              SELECT f.key
              FROM features f
              INNER JOIN admin_staff_feature_assignments a ON f.key = a.feature_key
              WHERE a.staff_id = ? AND a.enabled = 1
                AND f.key IN (${TAB_CONFIG.map(() => '?').join(',')})
            `, [userId, ...TAB_CONFIG.map(t => t.module_key)], (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          }
        });
        userPermissions = dbPerms.map(p => p.key);
      }

      // Filter tabs based on permissions
      const filteredTabs = TAB_CONFIG
        .filter(tab => userPermissions.includes(tab.module_key))
        .sort((a, b) => a.display_order - b.display_order);

      return {
        success: true,
        data: filteredTabs
      };

    } catch (error) {
      console.error('Error getting candidate tabs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // TOGGLE MODULE (SuperAdmin only)
  // ============================================
  ipcMain.handle('permission:toggleModule', async (event, args) => {
    try {
      const { user, moduleKey, isEnabled } = args;

      if (user.role !== 'super_admin') {
        return {
          success: false,
          error: 'Only SuperAdmin can toggle modules'
        };
      }

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO superadmin_admin_feature_toggles (feature_key, enabled)
          VALUES (?, ?)
          ON CONFLICT(feature_key) DO UPDATE SET enabled = ?
        `, [moduleKey, isEnabled ? 1 : 0, isEnabled ? 1 : 0], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return { success: true };

    } catch (error) {
      console.error('Error toggling module:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // GRANT PERMISSION (Admin → Staff)
  // ============================================
  ipcMain.handle('permission:grantPermission', async (event, args) => {
    try {
      const { user, userId, moduleKey } = args;

      if (user.role !== 'admin') {
        return {
          success: false,
          error: 'Only Admin can grant permissions'
        };
      }

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO admin_staff_feature_assignments (staff_id, feature_key, enabled)
          VALUES (?, ?, 1)
          ON CONFLICT(staff_id, feature_key) DO UPDATE SET enabled = 1
        `, [userId, moduleKey], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return { success: true };

    } catch (error) {
      console.error('Error granting permission:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // REVOKE PERMISSION (Admin → Staff)
  // ============================================
  ipcMain.handle('permission:revokePermission', async (event, args) => {
    try {
      const { user, userId, moduleKey } = args;

      if (user.role !== 'admin') {
        return {
          success: false,
          error: 'Only Admin can revoke permissions'
        };
      }

      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE admin_staff_feature_assignments 
          SET enabled = 0 
          WHERE staff_id = ? AND feature_key = ?
        `, [userId, moduleKey], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return { success: true };

    } catch (error) {
      console.error('Error revoking permission:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // BULK UPDATE PERMISSIONS
  // ============================================
  ipcMain.handle('permission:bulkUpdatePermissions', async (event, args) => {
    try {
      const { user, userId, moduleKeys } = args;

      if (user.role !== 'admin') {
        return {
          success: false,
          error: 'Only Admin can update permissions'
        };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // First, disable all permissions for this user
        await new Promise((resolve, reject) => {
          db.run(`
            UPDATE admin_staff_feature_assignments 
            SET enabled = 0 
            WHERE staff_id = ?
          `, [userId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Then grant specified permissions
        for (const moduleKey of moduleKeys) {
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO admin_staff_feature_assignments (staff_id, feature_key, enabled)
              VALUES (?, ?, 1)
              ON CONFLICT(staff_id, feature_key) DO UPDATE SET enabled = 1
            `, [userId, moduleKey], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }

        // Commit transaction
        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return { success: true };

      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          db.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('Error bulk updating permissions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('✅ Permission handlers registered');
}

module.exports = { registerPermissionHandlers };
