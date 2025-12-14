/**
 * Permission Engine
 * Single source of truth for roles, features, and access control
 * Enforces: SuperAdmin > Admin > Staff (strict inheritance)
 */

'use strict';

// -----------------------------
// Role Definitions
// -----------------------------
const ROLES = Object.freeze({
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  STAFF: 'staff',
});

// -----------------------------
// Feature Registry
// Add ALL app features here (extend safely anytime)
// -----------------------------
const FEATURES = Object.freeze({
  DASHBOARD: 'dashboard',
  USERS: 'users',
  SETTINGS: 'settings',
  REPORTS: 'reports',
  BILLING: 'billing',
  CLIENTS: 'clients',
  CONSULTANTS: 'consultants',
  AUDIT_LOGS: 'audit_logs',
});

// -----------------------------
// Permission Engine
// -----------------------------
class PermissionEngine {
  /**
   * @param {Object} params
   * @param {string} params.role - current user role
   * @param {string[]} params.superAdminEnabled - features enabled by SuperAdmin
   * @param {string[]} params.adminGranted - features granted by Admin
   */
  constructor({ role, superAdminEnabled = [], adminGranted = [] }) {
    this.role = role;
    this.superAdminEnabled = new Set(superAdminEnabled);
    this.adminGranted = new Set(adminGranted);
  }

  // -----------------------------
  // Core Checks
  // -----------------------------

  isSuperAdmin() {
    return this.role === ROLES.SUPER_ADMIN;
  }

  isAdmin() {
    return this.role === ROLES.ADMIN;
  }

  isStaff() {
    return this.role === ROLES.STAFF;
  }

  /**
   * Determine if a feature is accessible
   * @param {string} feature
   * @returns {boolean}
   */
  canAccess(feature) {
    // SuperAdmin: absolute access
    if (this.isSuperAdmin()) return true;

    // Admin: must be enabled by SuperAdmin
    if (this.isAdmin()) {
      return this.superAdminEnabled.has(feature);
    }

    // Staff: must be enabled by SuperAdmin AND granted by Admin
    if (this.isStaff()) {
      return (
        this.superAdminEnabled.has(feature) &&
        this.adminGranted.has(feature)
      );
    }

    return false;
  }

  /**
   * Enforce access (use in IPC / backend)
   * Throws error on violation
   */
  enforce(feature) {
    if (!this.canAccess(feature)) {
      const err = new Error('ACCESS_DENIED');
      err.code = 'ACCESS_DENIED';
      err.feature = feature;
      err.role = this.role;
      throw err;
    }
    return true;
  }

  /**
   * Filter a list of features based on role
   * Useful for UI menu generation
   */
  filterFeatures(featureList = []) {
    return featureList.filter((f) => this.canAccess(f));
  }

  /**
   * Admin safety: ensure Admin cannot grant beyond SuperAdmin
   */
  static sanitizeAdminGrants(superAdminEnabled = [], adminRequested = []) {
    const superSet = new Set(superAdminEnabled);
    return adminRequested.filter((f) => superSet.has(f));
  }
}

// -----------------------------
// Exports
// -----------------------------
module.exports = {
  ROLES,
  FEATURES,
  PermissionEngine,
};
