// src/utils/permissionUtils.js

// Read granular permissions from store
export const mapGranularToLinks = (granular) => ({
  // Core modules → links
  dashboard: true, // always visible
  search: granular.candidate_search === true,
  add: granular.add_candidate === true,
  import: granular.bulk_import === true,
  employers: granular.employers === true,
  jobs: granular.job_orders === true,
  visa: granular.visa_board === true,

  // System
  reports: granular.system_reports === true,
  'audit-log': granular.system_audit_log === true,
  'system-modules': granular.system_modules === true,
  'recycle-bin': granular.system_recycle_bin === true,

  // Settings main entry is allowed for Admin/SuperAdmin; inside tabs we use setting_* perms
  settings: true,
});

/**
 * Unified visibility checker for sidebar links.
 * user: { role }
 * flags: existing global feature flags (ceiling)
 * linkKey: 'search' | 'add' | 'import' | ...
 * granularLinks: result of mapGranularToLinks()
 */
export const canViewLinkWithGranular = (user, flags, linkKey, granularLinks) => {
  if (!user || !flags) return false;

  // Super Admin ↔ Full access regardless
  if (user.role === 'super_admin') return true;

  // Old ceiling: if global module is disabled, no one sees it
  if (linkKey === 'employers' && !flags.isEmployersEnabled) return false;
  if (linkKey === 'jobs' && !flags.isJobsEnabled) return false;
  if (linkKey === 'import' && !flags.isBulkImportEnabled) return false;
  if (linkKey === 'visa' && !flags.isVisaKanbanEnabled) return false;

  if (linkKey === 'reports' && !flags.canViewReports) return false;
  if (linkKey === 'audit-log' && !flags.canAccessSettings) return false;
  if (linkKey === 'settings' && !flags.canAccessSettings && user.role !== 'super_admin') return false;
  if (linkKey === 'recycle-bin' && !flags.canAccessRecycleBin) return false;

  // Now apply per-user granular visibility
  if (!granularLinks) return false;

  // Dashboard / basic candidate actions:
  if (linkKey === 'dashboard') return true;

  return granularLinks[linkKey] === true;
};
