// ============================================================================
// FILE: src-electron/preload.cjs
// PURPOSE: Expose Electron APIs to Renderer Process via contextBridge
// SECURITY: Uses contextIsolation to prevent direct access to Node.js/Electron
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  
  // ==========================================================================
  // 🔐 AUTHENTICATION & USER MANAGEMENT
  // ==========================================================================
  
  // Login & Registration
  login: (args) => ipcRenderer.invoke('login', args),
  registerNewUser: (args) => ipcRenderer.invoke('register-new-user', args),
  
  // User CRUD
  getAllUsers: () => ipcRenderer.invoke('get-all-users'),
  addUser: (args) => ipcRenderer.invoke('add-user', args),
  resetUserPassword: (args) => ipcRenderer.invoke('reset-user-password', args),
  changeMyPassword: (args) => ipcRenderer.invoke('change-my-password', args),
  deleteUser: (args) => ipcRenderer.invoke('delete-user', args),
  getUserRole: (args) => ipcRenderer.invoke('get-user-role', args),
  getUsers: (data) => ipcRenderer.invoke('get-users', data),

  // ==========================================================================
  // 🔑 PERMISSIONS & FEATURE FLAGS
  // ==========================================================================
  
  // User Permissions
  getUserPermissions: (args) => ipcRenderer.invoke('get-user-permissions', args),
  saveUserPermissions: (args) => ipcRenderer.invoke('save-user-permissions', args),
  getUserGranularPermissions: (args) => ipcRenderer.invoke('get-user-granular-permissions', args),
  setUserGranularPermissions: (args) => ipcRenderer.invoke('set-user-granular-permissions', args),
  getGranterPermissions: (args) => ipcRenderer.invoke('get-granter-permissions', args),
  getAssignablePermissions: (data) => ipcRenderer.invoke('getAssignablePermissions', data),
  validatePermissionAssignment: (data) => ipcRenderer.invoke('validatePermissionAssignment', data),
  
  // Feature Flags
  getFeatureFlags: () => ipcRenderer.invoke('get-feature-flags'),
  saveFeatureFlags: (args) => ipcRenderer.invoke('save-feature-flags', args),
  getAdminAssignedFeatures: (payload) => ipcRenderer.invoke('get-admin-assigned-features', payload),
  getAdminEffectiveFlags: (payload) => ipcRenderer.invoke('get-admin-effective-flags', payload),

  // ==========================================================================
  // 👥 CANDIDATE MANAGEMENT
  // ==========================================================================
  
  searchCandidates: (args) => ipcRenderer.invoke('search-candidates', args),
  getCandidateDetails: (args) => ipcRenderer.invoke('get-candidate-details', args),
  getCandidateById: (data) => ipcRenderer.invoke('get-candidate-by-id', data),
  saveCandidateMulti: (args) => ipcRenderer.invoke('save-candidate-multi', args),
  updateCandidateText: (args) => ipcRenderer.invoke('update-candidate-text', args),
  deleteCandidate: (args) => ipcRenderer.invoke('delete-candidate', args),
  getCandidateJobPlacements: (data) => ipcRenderer.invoke('get-candidate-job-placements', data),

  // ==========================================================================
  // 📄 DOCUMENT MANAGEMENT
  // ==========================================================================
  
  // Document Operations
  addDocuments: (args) => ipcRenderer.invoke('add-documents', args),
  deleteDocument: (id) => ipcRenderer.invoke('delete-document', id),
  getDocumentBase64: (args) => ipcRenderer.invoke('get-document-base64', args),
  openFileExternally: (args) => ipcRenderer.invoke('open-file-externally', args),
  uploadDocument: (data) => ipcRenderer.invoke('upload-document', data),
  // Upload progress events: subscribe and unsubscribe. Returns an unsubscribe function when called.
  onUploadProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('upload-progress', handler);
    return () => ipcRenderer.removeListener('upload-progress', handler);
  },
  getCandidateDocuments: (candidateId) => ipcRenderer.invoke('get-candidate-documents', candidateId),
  downloadDocument: (documentId) => ipcRenderer.invoke('download-document', documentId),
  uploadResume: (data) => ipcRenderer.invoke('upload-resume', data),
  uploadPhoto: (data) => ipcRenderer.invoke('upload-photo', data),
  updateDocumentCategory: (args) => ipcRenderer.invoke('update-document-category', args),
  
  // Bulk Import
  bulkImportDocuments: (args) => ipcRenderer.invoke('bulk-import-documents', args),
  getExcelSheets: (args) => ipcRenderer.invoke('get-excel-sheets', args),
  getExcelHeaders: (args) => ipcRenderer.invoke('get-excel-headers', args),
  getCsvHeaders: (args) => ipcRenderer.invoke('get-csv-headers', args),
  importCandidatesFromExcel: (args) => ipcRenderer.invoke('import-candidates-from-excel', args),
  importCandidatesFromFile: (args) => ipcRenderer.invoke('import-candidates-from-file', args),
  downloadExcelTemplate: () => ipcRenderer.invoke('download-excel-template'),
  downloadImportErrors: (args) => ipcRenderer.invoke('download-import-errors', args),
  
  // File Utilities
  readAbsoluteFileBuffer: (params) => ipcRenderer.invoke('read-absolute-file-buffer', params),
  getImageBase64: (params) => ipcRenderer.invoke('getImageBase64', params),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  zipCandidateDocuments: (args) => ipcRenderer.invoke('zip-candidate-documents', args),
  
  // Required Documents Master
  getRequiredDocuments: () => ipcRenderer.invoke('get-required-documents'),
  addRequiredDocument: (args) => ipcRenderer.invoke('add-required-document', args),
  deleteRequiredDocument: (args) => ipcRenderer.invoke('delete-required-document', args),
  getDeletedRequiredDocuments: () => ipcRenderer.invoke('get-deleted-required-documents'),
  restoreRequiredDocument: (args) => ipcRenderer.invoke('restore-required-document', args),
   readTextFile: (args) => ipcRenderer.invoke('readTextFile', args),

  // ==========================================================================
  // 🏢 EMPLOYER & JOB ORDER MANAGEMENT
  // ==========================================================================
  
  // Employers
  getEmployers: () => ipcRenderer.invoke('get-employers'),
  addEmployer: (args) => ipcRenderer.invoke('add-employer', args),
  updateEmployer: (args) => ipcRenderer.invoke('update-employer', args),
  deleteEmployer: (args) => ipcRenderer.invoke('delete-employer', args),
  
  // Job Orders
  getJobOrders: () => ipcRenderer.invoke('get-job-orders'),
  getJobOrderById: (data) => ipcRenderer.invoke('get-job-order-by-id', data),
  addJobOrder: (args) => ipcRenderer.invoke('add-job-order', args),
  updateJobOrder: (args) => ipcRenderer.invoke('update-job-order', args),
  deleteJobOrder: (args) => ipcRenderer.invoke('delete-job-order', args),

  // ==========================================================================
  // 📌 PLACEMENTS
  // ==========================================================================
  
  getCandidatePlacements: (args) => ipcRenderer.invoke('get-candidate-placements', args),
  getUnassignedJobs: (args) => ipcRenderer.invoke('get-unassigned-jobs', args),
  assignCandidateToJob: (args) => ipcRenderer.invoke('assign-candidate-to-job', args),
  removeCandidateFromJob: (args) => ipcRenderer.invoke('remove-candidate-from-job', args),

  // ==========================================================================
  // 🛂 PASSPORT TRACKING (UNIFIED SYSTEM)
  // ==========================================================================
  
  // Get Movements
  getPassportMovements: (data) => ipcRenderer.invoke('get-passport-movements', data),
  getPassportMovementPhotos: (data) => ipcRenderer.invoke('get-passport-movement-photos', data),
  // Add Movement (RECEIVE or SEND)
  addPassportMovement: (data) => ipcRenderer.invoke('add-passport-movement', data),
  getAllDeletedPassportMovements: (user) =>    ipcRenderer.invoke('get-all-deleted-passport-movements', { user }),
  // Add Photos to Movement
  addPassportMovementPhotos: (data) => ipcRenderer.invoke('add-passport-movement-photos', data),
  deletePassportMovementPhoto: (data) => ipcRenderer.invoke('delete-passport-movement-photo', data),
  permanentDeletePassportMovement: (user, id) =>    ipcRenderer.invoke('permanent-delete-passport-movement', { user, id }),
  // Delete Movement
  deletePassportMovement: (data) => ipcRenderer.invoke('delete-passport-movement', data),
  getPassportMovementPhotos: (movementId) =>     ipcRenderer.invoke('get-passport-movement-photos', movementId),
  // Recycle Bin
  getDeletedPassportMovements: (data) => ipcRenderer.invoke('get-deleted-passport-movements', data),
  restorePassportMovement: (params) => ipcRenderer.invoke('restore-passport-movement', params),

  // ==========================================================================
  // 🌍 VISA TRACKING
  // ==========================================================================
  
  getVisaTracking: (args) => ipcRenderer.invoke('get-visa-tracking', args),
  addVisaEntry: (args) => ipcRenderer.invoke('add-visa-entry', args),
  updateVisaEntry: (args) => ipcRenderer.invoke('update-visa-entry', args),
  deleteVisaEntry: (args) => ipcRenderer.invoke('delete-visa-entry', args),
  getAllActiveVisas: () => ipcRenderer.invoke('get-all-active-visas'),
  updateVisaStatus: (args) => ipcRenderer.invoke('update-visa-status', args),

  // ==========================================================================
  // 🏥 MEDICAL TRACKING
  // ==========================================================================
  
  getMedicalTracking: (args) => ipcRenderer.invoke('get-medical-tracking', args),
  addMedicalEntry: (args) => ipcRenderer.invoke('add-medical-entry', args),
  updateMedicalEntry: (args) => ipcRenderer.invoke('update-medical-entry', args),
  deleteMedicalEntry: (args) => ipcRenderer.invoke('delete-medical-entry', args),

  // ==========================================================================
  // ✈️ TRAVEL TRACKING
  // ==========================================================================
  
  getTravelTracking: (args) => ipcRenderer.invoke('get-travel-tracking', args),
  addTravelEntry: (args) => ipcRenderer.invoke('add-travel-entry', args),
  updateTravelEntry: (args) => ipcRenderer.invoke('update-travel-entry', args),
  deleteTravelEntry: (args) => ipcRenderer.invoke('delete-travel-entry', args),

  // ==========================================================================
  // 🎤 INTERVIEW TRACKING
  // ==========================================================================
  
  getInterviewTracking: (args) => ipcRenderer.invoke('get-interview-tracking', args),
  addInterviewEntry: (args) => ipcRenderer.invoke('add-interview-entry', args),
  updateInterviewEntry: (args) => ipcRenderer.invoke('update-interview-entry', args),
  deleteInterviewEntry: (args) => ipcRenderer.invoke('delete-interview-entry', args),

  // ==========================================================================
  // 💰 FINANCE & PAYMENTS
  // ==========================================================================
  
  getCandidatePayments: (args) => ipcRenderer.invoke('get-candidate-payments', args),
  addPayment: (args) => ipcRenderer.invoke('add-payment', args),
  updatePayment: (args) => ipcRenderer.invoke('update-payment', args),
  deletePayment: (args) => ipcRenderer.invoke('delete-payment', args),

  // ==========================================================================
  // 🗑️ RECYCLE BIN
  // ==========================================================================
  
  // Candidates
  getDeletedCandidates: () => ipcRenderer.invoke('get-deleted-candidates'),
  restoreCandidate: (args) => ipcRenderer.invoke('restore-candidate', args),
  
  // Employers
  getDeletedEmployers: () => ipcRenderer.invoke('get-deleted-employers'),
  restoreEmployer: (args) => ipcRenderer.invoke('restore-employer', args),
  
  // Job Orders
  getDeletedJobOrders: () => ipcRenderer.invoke('get-deleted-job-orders'),
  restoreJobOrder: (args) => ipcRenderer.invoke('restore-job-order', args),
  
  // Placements
  getDeletedPlacements: () => ipcRenderer.invoke('get-deleted-placements'),
  restorePlacement: (payload) => ipcRenderer.invoke('restore-placement', payload),
  
  // Passports (Redundant - use above passport methods)
  getDeletedPassports: () => ipcRenderer.invoke('get-deleted-passports'),
  restorePassport: (payload) => ipcRenderer.invoke('restore-passport', payload),
  
  // Visas
  getDeletedVisas: () => ipcRenderer.invoke('get-deleted-visas'),
  restoreVisa: (payload) => ipcRenderer.invoke('restore-visa', payload),
  
  // Medical
  getDeletedMedical: () => ipcRenderer.invoke('get-deleted-medical'),
  restoreMedical: (payload) => ipcRenderer.invoke('restore-medical', payload),
  
  // Interviews
  getDeletedInterviews: () => ipcRenderer.invoke('get-deleted-interviews'),
  restoreInterview: (payload) => ipcRenderer.invoke('restore-interview', payload),
  
  // Travel
  getDeletedTravel: () => ipcRenderer.invoke('get-deleted-travel'),
  restoreTravel: (payload) => ipcRenderer.invoke('restore-travel', payload),
  
  // Permanent Delete
  deletePermanently: (payload) => ipcRenderer.invoke('delete-permanently', payload),

  // ==========================================================================
  // 📊 REPORTING & ANALYTICS
  // ==========================================================================
  
  getReportingData: (args) => ipcRenderer.invoke('get-reporting-data', args),
  getDetailedReportList: (args) => ipcRenderer.invoke('get-detailed-report-list', args),
  getAdvancedAnalytics: (timeRange) => ipcRenderer.invoke('get-advanced-analytics', timeRange),
  exportAnalytics: (format) => ipcRenderer.invoke('export-analytics', format),
  
  // Audit Logs
  getSystemAuditLog: (args) => ipcRenderer.invoke('get-system-audit-log', args),
  getAuditLogForCandidate: (args) => ipcRenderer.invoke('get-audit-log-for-candidate', args),
  logAuditEvent: (payload) => ipcRenderer.invoke('log-audit-event', payload),

  // ==========================================================================
  // 📝 PDF & OFFER LETTER GENERATION
  // ==========================================================================
  
  readOfferTemplate: (args) => ipcRenderer.invoke('read-offer-template', args),
  writeOfferTemplate: (args) => ipcRenderer.invoke('write-offer-template', args),
  generateOfferLetter: (args) => ipcRenderer.invoke('generate-offer-letter', args),
  printToPDF: (url) => ipcRenderer.invoke('print-to-pdf', url),

  // ==========================================================================
  // 💬 COMMUNICATION
  // ==========================================================================
  
  // WhatsApp
  sendWhatsAppBulk: (payload) => ipcRenderer.invoke('send-whatsapp-bulk', payload),
  openWhatsAppSingle: (payload) => ipcRenderer.invoke('open-whatsapp-single', payload),
  
  // Communication Logs
  logCommunication: (data) => ipcRenderer.invoke('logCommunication', data),
  getCommunicationLogs: (data) => ipcRenderer.invoke('getCommunicationLogs', data),
  getCommLogs: (args) => ipcRenderer.invoke('get-comm-logs', args),

  // ==========================================================================
  // 📧 EMAIL SETTINGS
  // ==========================================================================
  
  sendEmail: (args) => ipcRenderer.invoke('send-email', args),
  getSmtpSettings: () => ipcRenderer.invoke('get-smtp-settings'),
  saveSmtpSettings: (args) => ipcRenderer.invoke('save-smtp-settings', args),
  testSmtpConnection: (args) => ipcRenderer.invoke('test-smtp-connection', args),

  // ==========================================================================
  // 🤖 AI & OCR INTELLIGENCE
  // ==========================================================================
  
  scanPassport: (params) => ipcRenderer.invoke('ocr-scan-passport', params),
  ocrScanPassport: (params) => ipcRenderer.invoke('ocr-scan-passport', params),

  // ==========================================================================
  // ☁️ CLOUD SYNC & BACKUP
  // ==========================================================================
  
  // Cloud Sync
  initCloudSync: (provider, config) => ipcRenderer.invoke('init-cloud-sync', provider, config),
  testCloudConnection: (provider, config) => ipcRenderer.invoke('test-cloud-connection', provider, config),
  
  // Backup & Restore
  createBackup: () => ipcRenderer.invoke('create-backup'),
  createLocalBackup: (path) => ipcRenderer.invoke('create-local-backup', path),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  getBackupDetails: (fileId) => ipcRenderer.invoke('get-backup-details', fileId),
  restoreBackup: (fileId) => ipcRenderer.invoke('restore-backup', fileId),
  restoreLocalBackup: (path) => ipcRenderer.invoke('restore-local-backup', path),
  restoreDatabase: (args) => ipcRenderer.invoke('restore-database', args),
  deleteBackup: (fileId) => ipcRenderer.invoke('delete-backup', fileId),
  
  // Auto Sync
  enableAutoSync: (schedule) => ipcRenderer.invoke('enable-auto-sync', schedule),
  disableAutoSync: () => ipcRenderer.invoke('disable-auto-sync'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  
  // Export/Import
  exportDatabase: (destinationPath) => ipcRenderer.invoke('export-database', destinationPath),
  importDatabase: (sourcePath) => ipcRenderer.invoke('import-database', sourcePath),
  backupDatabase: (user, destinationPath) => ipcRenderer.invoke('backupDatabase', { user, destinationPath }),

  // ==========================================================================
  // 🔔 NOTIFICATIONS & REMINDERS
  // ==========================================================================
  
  // Notifications
  getNotifications: (args) => ipcRenderer.invoke('get-notifications', args),
  markNotificationAsRead: (args) => ipcRenderer.invoke('mark-notification-as-read', args),
  markAllNotificationsAsRead: () => ipcRenderer.invoke('mark-all-notifications-as-read'),
  deleteNotification: (args) => ipcRenderer.invoke('delete-notification', args),
  clearAllNotifications: () => ipcRenderer.invoke('clear-all-notifications'),
  createNotification: (data) => ipcRenderer.invoke('create-notification', data),
  
  // Notification Listener
  onNotification: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('notification-created', handler);
    return () => ipcRenderer.removeListener('notification-created', handler);
  },
  
  // Reminders
  onReminderDue: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('reminder-due', handler);
    return () => ipcRenderer.removeListener('reminder-due', handler);
  },
  initializeNotificationService: () => {
    ipcRenderer.send('notification-service-init');
  },
  getUserReminders: (params) => ipcRenderer.invoke('get-user-reminders', params),
  createReminder: (params) => ipcRenderer.invoke('create-reminder', params),

  // ==========================================================================
  // 🔧 SYSTEM UTILITIES
  // ==========================================================================
  getFileUrl: async (data) => ipcRenderer.invoke('get-file-url', data),

  // Dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // Network
  getServerIP: () => ipcRenderer.invoke('get-server-ip'),
  
  // License & Activation
  sendActivationEmail: (data) => ipcRenderer.invoke('send-activation-email', data),
  activateApplication: (code) => ipcRenderer.invoke('activate-application', code),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getActivationStatus: () => ipcRenderer.invoke('get-activation-status'),
  resetActivationStatus: () => ipcRenderer.invoke('reset-activation-status'),
  getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
  activateLicense: (args) => ipcRenderer.invoke('license:activate', args),
  requestActivationCode: () => ipcRenderer.invoke('request-activation-code'),

getStatus: () => ipcRenderer.invoke('whatsapp:getStatus'),
  logout: () => ipcRenderer.invoke('whatsapp:logout'),
  
  // Listen to WhatsApp events
  onQR: (callback) => ipcRenderer.on('whatsapp:qr', (_, data) => callback(data)),
  onReady: (callback) => ipcRenderer.on('whatsapp:ready', () => callback()),
  onAuthenticated: (callback) => ipcRenderer.on('whatsapp:authenticated', () => callback()),
  onDisconnected: (callback) => ipcRenderer.on('whatsapp:disconnected', (_, reason) => callback(reason)),
  onNewMessage: (callback) => ipcRenderer.on('whatsapp:new-message', (_, message) => callback(message)),
  onMessageAck: (callback) => ipcRenderer.on('whatsapp:message-ack', (_, data) => callback(data)),

// ✅ CORRECTED WHATSAPP API
whatsapp: {
  // ========== Conversations ==========
  getConversations: () => ipcRenderer.invoke('whatsapp:getConversations'),
  createConversation: (data) => ipcRenderer.invoke('whatsapp:createConversation', data),
  deleteConversation: (conversationId) => ipcRenderer.invoke('whatsapp:deleteConversation', conversationId),

  editMessage: (messageId, newContent) => ipcRenderer.invoke('whatsapp:editMessage', messageId, newContent),
  archiveConversation: (conversationId) => ipcRenderer.invoke('whatsapp:archiveConversation', conversationId),
  
  // ========== Messages ==========
  getMessages: (conversationId) => ipcRenderer.invoke('whatsapp:getMessages', conversationId),
  sendMessage: (data) => ipcRenderer.invoke('whatsapp:sendMessage', data),
  deleteMessage: (messageId) => ipcRenderer.invoke('whatsapp:deleteMessage', messageId),
  
  // ========== Candidates ==========
  // ✅ FIX: Changed from getCandidatesForChat to getCandidatesWithPhone
  getCandidatesWithPhone: () => ipcRenderer.invoke('whatsapp:getCandidatesWithPhone'),
  
  // ========== Settings & Status ==========
  getStatus: () => ipcRenderer.invoke('whatsapp:getStatus'),
  saveCredentials: (credentials) => ipcRenderer.invoke('whatsapp:saveCredentials', credentials),
  testConnection: (credentials) => ipcRenderer.invoke('whatsapp:testConnection', credentials), // ✅ ADDED
  logout: () => ipcRenderer.invoke('whatsapp:logout'),
  
  // ========== Event Listeners ==========
  onReady: (callback) => {    ipcRenderer.on('whatsapp:ready', () => callback());  },  
  onAuthenticated: (callback) => {    ipcRenderer.on('whatsapp:authenticated', () => callback());  },  
  onDisconnected: (callback) => {    ipcRenderer.on('whatsapp:disconnected', (_, reason) => callback(reason));  },  
  onNewMessage: (callback) => {    ipcRenderer.on('whatsapp:new-message', (_, message) => callback(message));  },  
  onMessageAck: (callback) => {    ipcRenderer.on('whatsapp:message-ack', (_, data) => callback(data));  }
  
}


});

// ==========================================================================
// 🔐 PERMISSION VISIBILITY (OPTIONAL UI HELPER)
// ==========================================================================

contextBridge.exposeInMainWorld('permission', {
  can: async (feature) => {
    try {
      const res = await ipcRenderer.invoke('ui-can-access', { feature });
      return !!res?.allowed;
    } catch {
      return false;
    }
  },
  getRole: async (userId) => {
    try {
      const res = await ipcRenderer.invoke('get-user-role', { userId });
      return res?.role || null;
    } catch {
      return null;
    }
  },
});