// FILE: src/constants/permissionKeys.js
// ✅ COMPLETE: Granular Permission Keys for ALL Application Features

export const PERMISSION_KEYS = {
  // ============================================
  // CORE MODULES (Main Navigation)
  // ============================================
  DASHBOARD: 'dashboard',
  CANDIDATE_SEARCH: 'candidate_search',
  ADD_CANDIDATE: 'add_candidate',
  BULK_IMPORT: 'bulk_import',
  EMPLOYERS: 'employers',
  JOB_ORDERS: 'job_orders',
  VISA_BOARD: 'visa_board',

  // ============================================
  // CANDIDATE DETAIL TABS (Tracking Modules)
  // ============================================
  TAB_PROFILE: 'tab_profile',
  TAB_PASSPORT: 'tab_passport',
  TAB_DOCUMENTS: 'tab_documents',
  TAB_JOB_PLACEMENTS: 'tab_job_placements',
  TAB_VISA_TRACKING: 'tab_visa_tracking',
  TAB_FINANCIAL: 'tab_financial',
  TAB_MEDICAL: 'tab_medical',
  TAB_INTERVIEW: 'tab_interview',
  TAB_TRAVEL: 'tab_travel',
  TAB_OFFER_LETTER: 'tab_offer_letter',
  TAB_HISTORY: 'tab_history',
  TAB_COMMS_LOG: 'tab_comms_log',

  // ============================================
  // MANAGEMENT MODULES
  // ============================================
  MANAGEMENT_EMPLOYERS: 'management_employers',
  MANAGEMENT_JOB_ORDERS: 'management_job_orders',
  MANAGEMENT_PLACEMENTS: 'management_placements',

  // ============================================
  // SETTINGS TABS
  // ============================================
  SETTINGS_USERS: 'settings_users',
  SETTINGS_REQUIRED_DOCS: 'settings_required_docs',
  SETTINGS_EMAIL: 'settings_email',
  SETTINGS_TEMPLATES: 'settings_templates',
  SETTINGS_MOBILE_APP: 'settings_mobile_app',
  SETTINGS_BACKUP: 'settings_backup',
  SETTINGS_FEATURE_FLAGS: 'settings_feature_flags',

  // ============================================
  // SYSTEM ACCESS & REPORTS
  // ============================================
  SYSTEM_REPORTS: 'system_reports',
  SYSTEM_AUDIT_LOG: 'system_audit_log',
  SYSTEM_WHATSAPP: 'system_whatsapp',
  SYSTEM_RECYCLE_BIN: 'system_recycle_bin',

  // ============================================
  // CANDIDATE ACTIONS
  // ============================================
  CANDIDATE_VIEW: 'candidate_view',
  CANDIDATE_EDIT: 'candidate_edit',
  CANDIDATE_DELETE: 'candidate_delete',
  CANDIDATE_EXPORT: 'candidate_export',

  // ============================================
  // DOCUMENT ACTIONS
  // ============================================
  DOCUMENT_VIEW: 'document_view',
  DOCUMENT_UPLOAD: 'document_upload',
  DOCUMENT_DOWNLOAD: 'document_download',
  DOCUMENT_DELETE: 'document_delete',
  DOCUMENT_BULK_IMPORT: 'document_bulk_import',

  // ============================================
  // FINANCIAL PERMISSIONS
  // ============================================
  FINANCIAL_VIEW: 'financial_view',
  FINANCIAL_ADD_PAYMENT: 'financial_add_payment',
  FINANCIAL_EDIT_PAYMENT: 'financial_edit_payment',
  FINANCIAL_DELETE_PAYMENT: 'financial_delete_payment',

  // ============================================
  // EMPLOYER PERMISSIONS
  // ============================================
  EMPLOYER_VIEW: 'employer_view',
  EMPLOYER_ADD: 'employer_add',
  EMPLOYER_EDIT: 'employer_edit',
  EMPLOYER_DELETE: 'employer_delete',

  // ============================================
  // JOB ORDER PERMISSIONS
  // ============================================
  JOB_ORDER_VIEW: 'job_order_view',
  JOB_ORDER_ADD: 'job_order_add',
  JOB_ORDER_EDIT: 'job_order_edit',
  JOB_ORDER_DELETE: 'job_order_delete',

  // ============================================
  // PLACEMENT PERMISSIONS
  // ============================================
  PLACEMENT_VIEW: 'placement_view',
  PLACEMENT_ASSIGN: 'placement_assign',
  PLACEMENT_REMOVE: 'placement_remove',

  // ============================================
  // TRACKING MODULE PERMISSIONS
  // ============================================
  PASSPORT_ADD: 'passport_add',
  PASSPORT_EDIT: 'passport_edit',
  PASSPORT_DELETE: 'passport_delete',

  VISA_ADD: 'visa_add',
  VISA_EDIT: 'visa_edit',
  VISA_DELETE: 'visa_delete',

  MEDICAL_ADD: 'medical_add',
  MEDICAL_EDIT: 'medical_edit',
  MEDICAL_DELETE: 'medical_delete',

  INTERVIEW_ADD: 'interview_add',
  INTERVIEW_EDIT: 'interview_edit',
  INTERVIEW_DELETE: 'interview_delete',

  TRAVEL_ADD: 'travel_add',
  TRAVEL_EDIT: 'travel_edit',
  TRAVEL_DELETE: 'travel_delete',

  // ============================================
  // USER MANAGEMENT PERMISSIONS
  // ============================================
  USER_ADD: 'user_add',
  USER_EDIT: 'user_edit',
  USER_DELETE: 'user_delete',
  USER_RESET_PASSWORD: 'user_reset_password',
  USER_SET_PERMISSIONS: 'user_set_permissions',

  // ============================================
  // REPORT PERMISSIONS
  // ============================================
  REPORT_VIEW_DASHBOARD: 'report_view_dashboard',
  REPORT_EXPORT_DATA: 'report_export_data',
  REPORT_DETAILED_LIST: 'report_detailed_list',

  // ============================================
  // RECYCLE BIN PERMISSIONS
  // ============================================
  RECYCLE_BIN_VIEW: 'recycle_bin_view',
  RECYCLE_BIN_RESTORE: 'recycle_bin_restore',
  RECYCLE_BIN_DELETE_PERMANENT: 'recycle_bin_delete_permanent',
};

// ============================================
// GROUPED PERMISSIONS FOR UI DISPLAY
// ============================================
export const PERMISSION_GROUPS = {

    

  CORE_MODULES: {
    title: 'Core Modules',
    description: 'Main application features and navigation',
    permissions: [
      { key: PERMISSION_KEYS.DASHBOARD, label: 'Dashboard', icon: '📊', description: 'View dashboard and analytics' },
      { key: PERMISSION_KEYS.CANDIDATE_SEARCH, label: 'Candidate Search', icon: '🔍', description: 'Search and view candidates' },
      { key: PERMISSION_KEYS.ADD_CANDIDATE, label: 'Add New Candidate', icon: '➕', description: 'Create new candidate records' },
      { key: PERMISSION_KEYS.BULK_IMPORT, label: 'Bulk Import', icon: '📥', description: 'Import multiple candidates via Excel/CSV' },
      { key: PERMISSION_KEYS.VISA_BOARD, label: 'Visa Board', icon: '🛂', description: 'View visa status board' },
    ]
  },

  MANAGEMENT: {
    title: 'Management Modules',
    description: 'Employer and job management',
    permissions: [
      { key: PERMISSION_KEYS.EMPLOYERS, label: 'Employers', icon: '🏢', description: 'View employer list' },
      { key: PERMISSION_KEYS.EMPLOYER_ADD, label: 'Add Employer', icon: '➕', description: 'Create new employers' },
      { key: PERMISSION_KEYS.EMPLOYER_EDIT, label: 'Edit Employer', icon: '✏️', description: 'Modify employer details' },
      { key: PERMISSION_KEYS.EMPLOYER_DELETE, label: 'Delete Employer', icon: '🗑️', description: 'Remove employers' },
      
      { key: PERMISSION_KEYS.JOB_ORDERS, label: 'Job Orders', icon: '📋', description: 'View job orders' },
      { key: PERMISSION_KEYS.JOB_ORDER_ADD, label: 'Add Job Order', icon: '➕', description: 'Create new job orders' },
      { key: PERMISSION_KEYS.JOB_ORDER_EDIT, label: 'Edit Job Order', icon: '✏️', description: 'Modify job orders' },
      { key: PERMISSION_KEYS.JOB_ORDER_DELETE, label: 'Delete Job Order', icon: '🗑️', description: 'Remove job orders' },
    ]
  },

  CANDIDATE_ACTIONS: {
    title: 'Candidate Actions',
    description: 'Operations on candidate records',
    permissions: [
      { key: PERMISSION_KEYS.CANDIDATE_VIEW, label: 'View Candidate Details', icon: '👁️', description: 'Access candidate information' },
      { key: PERMISSION_KEYS.CANDIDATE_EDIT, label: 'Edit Candidate', icon: '✏️', description: 'Modify candidate records' },
      { key: PERMISSION_KEYS.CANDIDATE_DELETE, label: 'Delete Candidate', icon: '🗑️', description: 'Remove candidates' },
      { key: PERMISSION_KEYS.CANDIDATE_EXPORT, label: 'Export Candidate Data', icon: '📤', description: 'Export to Excel/PDF' },
    ]
  },

  TRACKING_TABS: {
    title: 'Candidate Tracking Tabs',
    description: 'Access to various tracking modules',
    permissions: [
      { key: PERMISSION_KEYS.TAB_PROFILE, label: 'Profile', icon: '👤', description: 'Basic candidate information' },
      { key: PERMISSION_KEYS.TAB_PASSPORT, label: 'Passport Tracking', icon: '📖', description: 'Passport status and details' },
      { key: PERMISSION_KEYS.TAB_DOCUMENTS, label: 'Documents', icon: '📄', description: 'Upload and manage documents' },
      { key: PERMISSION_KEYS.TAB_JOB_PLACEMENTS, label: 'Job Placements', icon: '💼', description: 'Assign candidates to jobs' },
      { key: PERMISSION_KEYS.TAB_VISA_TRACKING, label: 'Visa Tracking', icon: '✈️', description: 'Visa application status' },
      { key: PERMISSION_KEYS.TAB_FINANCIAL, label: 'Financial Tracking', icon: '💰', description: 'Payment and finance records' },
      { key: PERMISSION_KEYS.TAB_MEDICAL, label: 'Medical', icon: '🏥', description: 'Medical test records' },
      { key: PERMISSION_KEYS.TAB_INTERVIEW, label: 'Interview/Schedule', icon: '📅', description: 'Interview scheduling' },
      { key: PERMISSION_KEYS.TAB_TRAVEL, label: 'Travel/Tickets', icon: '🎫', description: 'Travel and ticket booking' },
      { key: PERMISSION_KEYS.TAB_OFFER_LETTER, label: 'Offer Letter', icon: '📜', description: 'Generate offer letters' },
      { key: PERMISSION_KEYS.TAB_HISTORY, label: 'History', icon: '🕐', description: 'View change history' },
      { key: PERMISSION_KEYS.TAB_COMMS_LOG, label: 'Communications Log', icon: '💬', description: 'Communication records' },
    ]
  },

  DOCUMENTS: {
    title: 'Document Management',
    description: 'Document operations and bulk imports',
    permissions: [
      { key: PERMISSION_KEYS.DOCUMENT_VIEW, label: 'View Documents', icon: '👁️', description: 'Access candidate documents' },
      { key: PERMISSION_KEYS.DOCUMENT_UPLOAD, label: 'Upload Documents', icon: '📤', description: 'Add new documents' },
      { key: PERMISSION_KEYS.DOCUMENT_DOWNLOAD, label: 'Download Documents', icon: '📥', description: 'Download files' },
      { key: PERMISSION_KEYS.DOCUMENT_DELETE, label: 'Delete Documents', icon: '🗑️', description: 'Remove documents' },
      { key: PERMISSION_KEYS.DOCUMENT_BULK_IMPORT, label: 'Bulk Document Import', icon: '📦', description: 'Import document archives' },
    ]
  },

  FINANCIAL: {
    title: 'Financial Management',
    description: 'Payment and billing operations',
    permissions: [
      { key: PERMISSION_KEYS.FINANCIAL_VIEW, label: 'View Financials', icon: '💵', description: 'Access payment records' },
      { key: PERMISSION_KEYS.FINANCIAL_ADD_PAYMENT, label: 'Add Payment', icon: '➕', description: 'Create payment records' },
      { key: PERMISSION_KEYS.FINANCIAL_EDIT_PAYMENT, label: 'Edit Payment', icon: '✏️', description: 'Modify payments' },
      { key: PERMISSION_KEYS.FINANCIAL_DELETE_PAYMENT, label: 'Delete Payment', icon: '🗑️', description: 'Remove payment records' },
    ]
  },

  TRACKING_OPERATIONS: {
    title: 'Tracking Operations',
    description: 'Add, edit, delete tracking records',
    permissions: [
      { key: PERMISSION_KEYS.PASSPORT_ADD, label: 'Add Passport Entry', icon: '➕', description: 'Create passport records' },
      { key: PERMISSION_KEYS.PASSPORT_EDIT, label: 'Edit Passport Entry', icon: '✏️', description: 'Modify passport records' },
      { key: PERMISSION_KEYS.PASSPORT_DELETE, label: 'Delete Passport Entry', icon: '🗑️', description: 'Remove passport records' },
      
      { key: PERMISSION_KEYS.VISA_ADD, label: 'Add Visa Entry', icon: '➕', description: 'Create visa records' },
      { key: PERMISSION_KEYS.VISA_EDIT, label: 'Edit Visa Entry', icon: '✏️', description: 'Modify visa records' },
      { key: PERMISSION_KEYS.VISA_DELETE, label: 'Delete Visa Entry', icon: '🗑️', description: 'Remove visa records' },
      
      { key: PERMISSION_KEYS.MEDICAL_ADD, label: 'Add Medical Entry', icon: '➕', description: 'Create medical records' },
      { key: PERMISSION_KEYS.MEDICAL_EDIT, label: 'Edit Medical Entry', icon: '✏️', description: 'Modify medical records' },
      { key: PERMISSION_KEYS.MEDICAL_DELETE, label: 'Delete Medical Entry', icon: '🗑️', description: 'Remove medical records' },
      
      { key: PERMISSION_KEYS.INTERVIEW_ADD, label: 'Add Interview', icon: '➕', description: 'Schedule interviews' },
      { key: PERMISSION_KEYS.INTERVIEW_EDIT, label: 'Edit Interview', icon: '✏️', description: 'Modify interview records' },
      { key: PERMISSION_KEYS.INTERVIEW_DELETE, label: 'Delete Interview', icon: '🗑️', description: 'Remove interviews' },
      
      { key: PERMISSION_KEYS.TRAVEL_ADD, label: 'Add Travel Entry', icon: '➕', description: 'Create travel records' },
      { key: PERMISSION_KEYS.TRAVEL_EDIT, label: 'Edit Travel Entry', icon: '✏️', description: 'Modify travel records' },
      { key: PERMISSION_KEYS.TRAVEL_DELETE, label: 'Delete Travel Entry', icon: '🗑️', description: 'Remove travel records' },
    ]
  },

    SETTINGS_TABS: {
    title: 'System Settings',
    description: 'Application settings and configuration',
    permissions: [
      { key: PERMISSION_KEYS.SETTINGS_USERS, label: 'User Management', icon: '👥', description: 'Manage system users' },
      { key: PERMISSION_KEYS.SETTINGS_REQUIRED_DOCS, label: 'Required Documents', icon: '📝', description: 'Configure document requirements' },
      { key: PERMISSION_KEYS.SETTINGS_EMAIL, label: 'Email Settings', icon: '📧', description: 'Configure SMTP and email' },
      { key: PERMISSION_KEYS.SETTINGS_TEMPLATES, label: 'Templates', icon: '📋', description: 'Manage letter templates' },
      { key: PERMISSION_KEYS.SETTINGS_MOBILE_APP, label: 'Mobile App', icon: '📱', description: 'Mobile app settings' },
      { key: PERMISSION_KEYS.SETTINGS_BACKUP, label: 'Backup & Restore', icon: '💾', description: 'Database backup operations' },
      { key: PERMISSION_KEYS.SETTINGS_FEATURE_FLAGS, label: 'Feature Toggles', icon: '🎛️', description: 'Enable/disable features' },
    ]
  },


  USER_MANAGEMENT: {
    title: 'User Management',
    description: 'User account operations',
    permissions: [
      { key: PERMISSION_KEYS.USER_ADD, label: 'Add User', icon: '➕', description: 'Create new users' },
      { key: PERMISSION_KEYS.USER_EDIT, label: 'Edit User', icon: '✏️', description: 'Modify user accounts' },
      { key: PERMISSION_KEYS.USER_DELETE, label: 'Delete User', icon: '🗑️', description: 'Remove users' },
      { key: PERMISSION_KEYS.USER_RESET_PASSWORD, label: 'Reset Password', icon: '🔑', description: 'Reset user passwords' },
      { key: PERMISSION_KEYS.USER_SET_PERMISSIONS, label: 'Set Permissions', icon: '🔐', description: 'Configure user permissions' },
    ]
  },

  SYSTEM_ACCESS: {
    title: 'System Access',
    description: 'Advanced system features',
    permissions: [
      { key: PERMISSION_KEYS.SYSTEM_REPORTS, label: 'View Reports', icon: '📊', description: 'Access reporting dashboard' },
      { key: PERMISSION_KEYS.REPORT_EXPORT_DATA, label: 'Export Reports', icon: '📤', description: 'Export report data' },
      { key: PERMISSION_KEYS.SYSTEM_AUDIT_LOG, label: 'Audit Log', icon: '📜', description: 'View system audit trail' },
      { key: PERMISSION_KEYS.SYSTEM_WHATSAPP, label: 'WhatsApp Bulk', icon: '💬', description: 'Send bulk WhatsApp messages' },
      { key: PERMISSION_KEYS.SYSTEM_RECYCLE_BIN, label: 'Recycle Bin', icon: '🗑️', description: 'Access deleted items' },
      { key: PERMISSION_KEYS.RECYCLE_BIN_RESTORE, label: 'Restore Items', icon: '♻️', description: 'Restore deleted records' },
      { key: PERMISSION_KEYS.RECYCLE_BIN_DELETE_PERMANENT, label: 'Permanent Delete', icon: '❌', description: 'Permanently delete items' },
    ]
  },

  

  PLACEMENTS: {
    title: 'Placement Management',
    description: 'Candidate job assignment operations',
    permissions: [
      { key: PERMISSION_KEYS.PLACEMENT_VIEW, label: 'View Placements', icon: '👁️', description: 'View candidate placements' },
      { key: PERMISSION_KEYS.PLACEMENT_ASSIGN, label: 'Assign to Job', icon: '➕', description: 'Assign candidates to jobs' },
      { key: PERMISSION_KEYS.PLACEMENT_REMOVE, label: 'Remove Placement', icon: '➖', description: 'Remove candidate assignments' },
    ]
  }
};



// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all permission keys as an array
 */
export const getAllPermissionKeys = () => Object.values(PERMISSION_KEYS);

/**
 * Get permission label by key
 */
export const getPermissionLabel = (key) => {
  for (const group of Object.values(PERMISSION_GROUPS)) {
    const perm = group.permissions.find(p => p.key === key);
    if (perm) return perm.label;
  }
  return key;
};

/**
 * Check if a permission key exists
 */
export const isValidPermissionKey = (key) => {
  return getAllPermissionKeys().includes(key);
};

export default PERMISSION_KEYS;
