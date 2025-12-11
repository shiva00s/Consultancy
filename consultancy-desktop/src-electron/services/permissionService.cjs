const { getDatabase } = require('../db/database.cjs'); // adjust path if different

class PermissionService {
  /**
   * Get all modules with hierarchy
   */
  async getAllModules() {
    const db = getDatabase();
    const query = `
      SELECT
        m.*,
        GROUP_CONCAT(md.requires_module_key) as dependencies
      FROM modules m
      LEFT JOIN module_dependencies md ON m.module_key = md.module_key
      GROUP BY m.id
      ORDER BY m.order_index
    `;
    return new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else {
          const modules = rows.map(row => ({
            ...row,
            dependencies: row.dependencies ? row.dependencies.split(',') : [],
            is_enabled: Boolean(row.is_enabled)
          }));
          resolve(modules);
        }
      });
    });
  }

  

  /**
   * Get enabled modules only (for non-SuperAdmin)
   */
  async getEnabledModules() {
    const db = getDatabase();
    const query = `
      SELECT
        m.*,
        GROUP_CONCAT(md.requires_module_key) as dependencies
      FROM modules m
      LEFT JOIN module_dependencies md ON m.module_key = md.module_key
      WHERE m.is_enabled = 1
      GROUP BY m.id
      ORDER BY m.order_index
    `;
    return new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else {
          const modules = rows.map(row => ({
            ...row,
            dependencies: row.dependencies ? row.dependencies.split(',') : [],
            is_enabled: true
          }));
          resolve(modules);
        }
      });
    });
  }

  /**
   * Get user permissions (for Staff)
   */
  async getUserPermissions(userId) {
    const db = getDatabase();
    const query = `
      SELECT
        rp.module_key,
        m.module_name,
        m.module_type,
        m.parent_key,
        m.route,
        m.icon
      FROM role_permissions rp
      INNER JOIN modules m ON rp.module_key = m.module_key
      WHERE rp.user_id = ? AND m.is_enabled = 1
      ORDER BY m.order_index
    `;
    return new Promise((resolve, reject) => {
      db.all(query, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get permissions for a user with hierarchy check
   */
  async getEffectivePermissions(userId, userRole) {
    // SuperAdmin gets everything
    if (userRole === 'super_admin') {
      return await this.getAllModules();
    }

    // Admin gets all enabled modules
    if (userRole === 'admin') {
      return await this.getEnabledModules();
    }

    // Staff gets only granted permissions within enabled modules
    if (userRole === 'staff') {
      return await this.getUserPermissions(userId);
    }

    return [];
  }

  /**
   * Check if user has permission for a module
   */
  async hasPermission(userId, userRole, moduleKey) {
    // SuperAdmin always has permission
    if (userRole === 'super_admin') {
      return true;
    }

    // Check if module is enabled
    const module = await this.getModuleByKey(moduleKey);
    if (!module || !module.is_enabled) {
      return false;
    }

    // Admin has permission if module is enabled
    if (userRole === 'admin') {
      return true;
    }

    // Staff needs explicit permission
    if (userRole === 'staff') {
      return await this.checkStaffPermission(userId, moduleKey);
    }

    return false;
  }

  /**
   * Check staff permission
   */
  async checkStaffPermission(userId, moduleKey) {
    const db = getDatabase();
    const query = `
      SELECT COUNT(*) as count
      FROM role_permissions rp
      INNER JOIN modules m ON rp.module_key = m.module_key
      WHERE rp.user_id = ? AND rp.module_key = ? AND m.is_enabled = 1
    `;
    return new Promise((resolve, reject) => {
      db.get(query, [userId, moduleKey], (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });
  }

  /**
   * Get module by key
   */
  async getModuleByKey(moduleKey) {
    const db = getDatabase();
    const query = 'SELECT * FROM modules WHERE module_key = ?';
    return new Promise((resolve, reject) => {
      db.get(query, [moduleKey], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Toggle module (SuperAdmin only)
   */
  async toggleModule(moduleKey, isEnabled, performedBy) {
    const db = getDatabase();
    const query = 'UPDATE modules SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE module_key = ?';
    return new Promise((resolve, reject) => {
      db.run(query, [isEnabled ? 1 : 0, moduleKey], function(err) {
        if (err) {
          reject(err);
        } else {
          // Log audit
          const auditQuery = `
            INSERT INTO permission_audit_log (action, module_key, performed_by, details)
            VALUES (?, ?, ?, ?)
          `;
          const action = isEnabled ? 'module_enabled' : 'module_disabled';
          const details = JSON.stringify({ changed_at: new Date().toISOString() });
          db.run(auditQuery, [action, moduleKey, performedBy, details]);
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  /**
   * Grant permission to user (Admin → Staff)
   */
  async grantPermission(userId, moduleKey, grantedBy) {
    // Check if module is enabled
    const module = await this.getModuleByKey(moduleKey);
    if (!module || !module.is_enabled) {
      throw new Error('Cannot grant permission for disabled module');
    }

    const db = getDatabase();
    const query = `
      INSERT INTO role_permissions (user_id, module_key, granted_by)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, module_key) DO UPDATE SET granted_at = CURRENT_TIMESTAMP
    `;
    return new Promise((resolve, reject) => {
      db.run(query, [userId, moduleKey, grantedBy], function(err) {
        if (err) {
          reject(err);
        } else {
          // Log audit
          const auditQuery = `
            INSERT INTO permission_audit_log (action, module_key, target_user_id, performed_by)
            VALUES ('granted', ?, ?, ?)
          `;
          db.run(auditQuery, [moduleKey, userId, grantedBy]);
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  /**
   * Revoke permission from user
   */
  async revokePermission(userId, moduleKey, performedBy) {
    const db = getDatabase();
    const query = 'DELETE FROM role_permissions WHERE user_id = ? AND module_key = ?';
    return new Promise((resolve, reject) => {
      db.run(query, [userId, moduleKey], function(err) {
        if (err) {
          reject(err);
        } else {
          // Log audit
          const auditQuery = `
            INSERT INTO permission_audit_log (action, module_key, target_user_id, performed_by)
            VALUES ('revoked', ?, ?, ?)
          `;
          db.run(auditQuery, [moduleKey, userId, performedBy]);
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get default staff permissions
   */
  async getDefaultStaffPermissions() {
    const db = getDatabase();
    const query = `
      SELECT module_key
      FROM default_staff_permissions
      WHERE is_default = 1
    `;
    return new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.module_key));
      });
    });
  }

  /**
   * Assign default permissions to new staff
   */
  async assignDefaultPermissions(userId, grantedBy) {
    const defaults = await this.getDefaultStaffPermissions();
    const promises = defaults.map(moduleKey =>
      this.grantPermission(userId, moduleKey, grantedBy)
    );
    return Promise.all(promises);
  }

  /**
   * Get permission audit log
   */
  async getAuditLog(filters = {}) {
    const db = getDatabase();
    let query = `
      SELECT
        pal.*,
        u.username as target_username,
        u2.username as performed_by_username
      FROM permission_audit_log pal
      LEFT JOIN users u ON pal.target_user_id = u.id
      LEFT JOIN users u2 ON pal.performed_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.userId) {
      query += ' AND pal.target_user_id = ?';
      params.push(filters.userId);
    }

    if (filters.moduleKey) {
      query += ' AND pal.module_key = ?';
      params.push(filters.moduleKey);
    }

    if (filters.action) {
      query += ' AND pal.action = ?';
      params.push(filters.action);
    }

    query += ' ORDER BY pal.created_at DESC LIMIT 100';
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Bulk update permissions for a user
   */
  async bulkUpdatePermissions(userId, moduleKeys, grantedBy) {
    const db = getDatabase();
    // Remove all existing permissions
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM role_permissions WHERE user_id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Grant new permissions
    const promises = moduleKeys.map(moduleKey =>
      this.grantPermission(userId, moduleKey, grantedBy).catch(err => {
        console.error(`Failed to grant ${moduleKey}:`, err.message);
        return null;
      })
    );

    await Promise.all(promises);
    return { success: true };
  }
}

module.exports = new PermissionService();
