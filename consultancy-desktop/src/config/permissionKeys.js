// Granular Permission Keys for the Application

export const PERMISSION_KEYS = {
    // Core Modules
    CANDIDATE_SEARCH: 'candidate_search',
    ADD_CANDIDATE: 'add_candidate',
    BULK_IMPORT: 'bulk_import',
    EMPLOYERS: 'employers',
    JOB_ORDERS: 'job_orders',
    VISA_BOARD: 'visa_board',

    // Candidate Detail Tabs (Tracking)
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

    // Settings Tabs
    SETTINGS_USERS: 'settings_users',
    SETTINGS_REQUIRED_DOCS: 'settings_required_docs',
    SETTINGS_EMAIL: 'settings_email',
    SETTINGS_TEMPLATES: 'settings_templates',
    SETTINGS_MOBILE_APP: 'settings_mobile_app',
    SETTINGS_BACKUP: 'settings_backup',

    // System Access
    SYSTEM_REPORTS: 'system_reports',
    SYSTEM_AUDIT_LOG: 'system_audit_log',
    SYSTEM_MODULES: 'system_modules',
    SYSTEM_RECYCLE_BIN: 'system_recycle_bin',
};

// Grouped for UI Display
export const PERMISSION_GROUPS = {
    CORE_MODULES: {
        title: 'Core Modules',
        permissions: [
            { key: PERMISSION_KEYS.CANDIDATE_SEARCH, label: 'Candidate Search', icon: '🔍' },
            { key: PERMISSION_KEYS.ADD_CANDIDATE, label: 'Add New Candidate', icon: '➕' },
            { key: PERMISSION_KEYS.BULK_IMPORT, label: 'Bulk Import', icon: '📥' },
            { key: PERMISSION_KEYS.EMPLOYERS, label: 'Employers', icon: '🏢' },
            { key: PERMISSION_KEYS.JOB_ORDERS, label: 'Job Orders', icon: '📋' },
            { key: PERMISSION_KEYS.VISA_BOARD, label: 'Visa Board', icon: '🛂' },
        ]
    },
    TRACKING_TABS: {
        title: 'Tracking Tabs',
        permissions: [
            { key: PERMISSION_KEYS.TAB_PROFILE, label: 'Profile', icon: '👤' },
            { key: PERMISSION_KEYS.TAB_PASSPORT, label: 'Passport Tracking', icon: '📖' },
            { key: PERMISSION_KEYS.TAB_DOCUMENTS, label: 'Documents', icon: '📄' },
            { key: PERMISSION_KEYS.TAB_JOB_PLACEMENTS, label: 'Job Placements', icon: '💼' },
            { key: PERMISSION_KEYS.TAB_VISA_TRACKING, label: 'Visa Tracking', icon: '✈️' },
            { key: PERMISSION_KEYS.TAB_FINANCIAL, label: 'Financial Tracking', icon: '💰' },
            { key: PERMISSION_KEYS.TAB_MEDICAL, label: 'Medical', icon: '🏥' },
            { key: PERMISSION_KEYS.TAB_INTERVIEW, label: 'Interview/Schedule', icon: '📅' },
            { key: PERMISSION_KEYS.TAB_TRAVEL, label: 'Travel/Tickets', icon: '🎫' },
            { key: PERMISSION_KEYS.TAB_OFFER_LETTER, label: 'Offer Letter', icon: '📜' },
            { key: PERMISSION_KEYS.TAB_HISTORY, label: 'History', icon: '🕐' },
            { key: PERMISSION_KEYS.TAB_COMMS_LOG, label: 'Communications Log', icon: '💬' },
        ]
    },
    SETTINGS_TABS: {
        title: 'Settings Tabs',
        permissions: [
            { key: PERMISSION_KEYS.SETTINGS_USERS, label: 'Users', icon: '👥' },
            { key: PERMISSION_KEYS.SETTINGS_REQUIRED_DOCS, label: 'Required Docs', icon: '📝' },
            { key: PERMISSION_KEYS.SETTINGS_EMAIL, label: 'Email', icon: '📧' },
            { key: PERMISSION_KEYS.SETTINGS_TEMPLATES, label: 'Templates', icon: '📋' },
            { key: PERMISSION_KEYS.SETTINGS_MOBILE_APP, label: 'Mobile App', icon: '📱' },
            { key: PERMISSION_KEYS.SETTINGS_BACKUP, label: 'Backup', icon: '💾' },
        ]
    },
    SYSTEM_ACCESS: {
        title: 'System Access',
        permissions: [
            { key: PERMISSION_KEYS.SYSTEM_REPORTS, label: 'View Reports', icon: '📊' },
            
            { key: PERMISSION_KEYS.SYSTEM_AUDIT_LOG, label: 'Audit Log', icon: '📜' },
            { key: PERMISSION_KEYS.SYSTEM_MODULES, label: 'WhatsApp', icon: '⚙️' },
            { key: PERMISSION_KEYS.SYSTEM_RECYCLE_BIN, label: 'Recycle Bin', icon: '🗑️' },
        ]
    }
};

export default PERMISSION_KEYS;
