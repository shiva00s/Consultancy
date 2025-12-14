/**
 * IPC Permission Guard
 * Safe bridge between existing handlers and PermissionEngine
 *
 * Usage pattern (later, one-by-one):
 *   guard(user, FEATURES.USERS).enforce();
 */

'use strict';

const {
  PermissionEngine,
  ROLES,
  FEATURES,
} = require('./permissionEngine.cjs');

class IpcPermissionGuard {
  constructor(user, context = {}) {
    this.user = user || null;

    this.role = user?.role || null;

    // Feature toggles resolved externally (DB / IPC)
    this.superAdminEnabled = context.superAdminEnabled || [];
    this.adminGranted = context.adminGranted || [];
  }

  /**
   * Create permission engine instance
   */
  engine() {
    return new PermissionEngine({
      role: this.role,
      superAdminEnabled: this.superAdminEnabled,
      adminGranted: this.adminGranted,
    });
  }

  /**
   * Enforce feature access
   * Throws standard error object used across app
   */
  enforce(feature) {
    if (!this.user || !this.user.id) {
      const err = new Error('AUTH_REQUIRED');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }

    const engine = this.engine();
    engine.enforce(feature);

    return true;
  }

  /**
   * Soft check (UI or optional logic)
   */
  can(feature) {
    if (!this.user || !this.user.id) return false;
    return this.engine().canAccess(feature);
  }

  /**
   * Strict hierarchy helpers
   */
  isSuperAdmin() {
    return this.role === ROLES.SUPER_ADMIN;
  }

  isAdmin() {
    return this.role === ROLES.ADMIN;
  }

  isStaff() {
    return this.role === ROLES.STAFF;
  }
}

/**
 * Factory helper
 */
function guard(user, context) {
  return new IpcPermissionGuard(user, context);
}

module.exports = {
  guard,
  IpcPermissionGuard,
  ROLES,
  FEATURES,
};
