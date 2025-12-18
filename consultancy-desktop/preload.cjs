const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // -------------------------------------------------------------------
  // REMINDERS / NOTIFICATIONS
  // -------------------------------------------------------------------
  onReminderDue: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("reminder-due", handler);
    return () => ipcRenderer.removeListener("reminder-due", handler);
  },
  initializeNotificationService: () => {
    ipcRenderer.send("notification-service-init");
  },

  // =====================================================================
  // SYSTEM
  // =====================================================================
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  backupDatabase: (args) => ipcRenderer.invoke("backup-database", args),
  restoreDatabase: (args) => ipcRenderer.invoke("restore-database", args),
  
  // SYSTEM
sendActivationEmail: (data) => ipcRenderer.invoke('send-activation-email', data),
activateApplication: (code) => ipcRenderer.invoke('activate-application', code),
getMachineId: () => ipcRenderer.invoke('get-machine-id'),
getActivationStatus: () => ipcRenderer.invoke('get-activation-status'),
resetActivationStatus: () => ipcRenderer.invoke('reset-activation-status'),

  getServerIP: () => ipcRenderer.invoke("get-server-ip"),

  // =====================================================================
  // LOGIN / USERS / PERMISSIONS
  // =====================================================================
  login: (args) => ipcRenderer.invoke("login", args),
  registerNewUser: (args) => ipcRenderer.invoke("register-new-user", args),
  getAllUsers: () => ipcRenderer.invoke("get-all-users"),
  addUser: (args) => ipcRenderer.invoke("add-user", args),
  resetUserPassword: (args) => ipcRenderer.invoke("reset-user-password", args),
  changeMyPassword: (args) => ipcRenderer.invoke("change-my-password", args),
  deleteUser: (args) => ipcRenderer.invoke("delete-user", args),
  getUserRole: (args) => ipcRenderer.invoke("get-user-role", args),

  getUserPermissions: (args) => ipcRenderer.invoke("get-user-permissions", args),
  saveUserPermissions: (args) => ipcRenderer.invoke("save-user-permissions", args),

  getUserGranularPermissions: (args) =>
    ipcRenderer.invoke("get-user-granular-permissions", args),
  setUserGranularPermissions: (args) =>
    ipcRenderer.invoke("set-user-granular-permissions", args),
  getGranterPermissions: (args) => ipcRenderer.invoke("get-granter-permissions", args),

  getAssignablePermissions: (data) =>
    ipcRenderer.invoke("getAssignablePermissions", data),
  validatePermissionAssignment: (data) =>
    ipcRenderer.invoke("validatePermissionAssignment", data),

  // =====================================================================
  // FEATURE FLAGS
  // =====================================================================
  getFeatureFlags: () => ipcRenderer.invoke("get-feature-flags"),
  saveFeatureFlags: (args) => ipcRenderer.invoke("save-feature-flags", args),
  getAdminAssignedFeatures: (payload) =>
    ipcRenderer.invoke("get-admin-assigned-features", payload),
  getAdminEffectiveFlags: (payload) =>
    ipcRenderer.invoke("get-admin-effective-flags", payload),

  // =====================================================================
  // REPORTING & ANALYTICS
  // =====================================================================
  getReportingData: (args) => ipcRenderer.invoke("get-reporting-data", args),
  getSystemAuditLog: (args) => ipcRenderer.invoke("get-system-audit-log", args),
  getAuditLogForCandidate: (args) =>
    ipcRenderer.invoke("get-audit-log-for-candidate", args),
  getDetailedReportList: (args) =>
    ipcRenderer.invoke("get-detailed-report-list", args),
  getAdvancedAnalytics: (timeRange) =>
    ipcRenderer.invoke("get-advanced-analytics", timeRange),
  exportAnalytics: (format) => ipcRenderer.invoke("export-analytics", format),
  logAuditEvent: (payload) => ipcRenderer.invoke("log-audit-event", payload),

  // =====================================================================
  // CANDIDATES
  // =====================================================================
  searchCandidates: (args) => ipcRenderer.invoke("search-candidates", args),
  getCandidateDetails: (args) =>
    ipcRenderer.invoke("get-candidate-details", args),
  getCandidateById: (data) => ipcRenderer.invoke("get-candidate-by-id", data),
  saveCandidateMulti: (args) => ipcRenderer.invoke("save-candidate-multi", args),
  updateCandidateText: (args) => ipcRenderer.invoke("update-candidate-text", args),
  deleteCandidate: (args) => ipcRenderer.invoke("delete-candidate", args),
  getCandidateJobPlacements: (data) =>
    ipcRenderer.invoke("get-candidate-job-placements", data),

  // =====================================================================
  // DOCUMENT MANAGEMENT
  // =====================================================================
  addDocuments: (args) => ipcRenderer.invoke("add-documents", args),
  deleteDocument: (id) => ipcRenderer.invoke("delete-document", id),
  getDocumentBase64: (args) => ipcRenderer.invoke("get-document-base64", args),
  openFileExternally: (args) => ipcRenderer.invoke("open-file-externally", args),
  readAbsoluteFileBuffer: (params) =>
    ipcRenderer.invoke("read-absolute-file-buffer", params),
  getImageBase64: (params) => ipcRenderer.invoke("getImageBase64", params),

  uploadDocument: (data) => ipcRenderer.invoke("upload-document", data),
  getCandidateDocuments: (candidateId) =>
    ipcRenderer.invoke("get-candidate-documents", candidateId),
  downloadDocument: (documentId) =>
    ipcRenderer.invoke("download-document", documentId),
  uploadResume: (data) => ipcRenderer.invoke("upload-resume", data),
  uploadPhoto: (data) => ipcRenderer.invoke("upload-photo", data),
  bulkImportDocuments: (args) =>
    ipcRenderer.invoke("bulk-import-documents", args),

  getExcelSheets: (args) => ipcRenderer.invoke("get-excel-sheets", args),
  getExcelHeaders: (args) => ipcRenderer.invoke("get-excel-headers", args),
  getCsvHeaders: (args) => ipcRenderer.invoke("get-csv-headers", args),
  importCandidatesFromExcel: (args) =>
    ipcRenderer.invoke("import-candidates-from-excel", args),
  importCandidatesFromFile: (args) =>
    ipcRenderer.invoke("import-candidates-from-file", args),
  downloadExcelTemplate: () => ipcRenderer.invoke("download-excel-template"),
  downloadImportErrors: (args) =>
    ipcRenderer.invoke("download-import-errors", args),

  // Required Document Master
  getRequiredDocuments: () => ipcRenderer.invoke("get-required-documents"),
  addRequiredDocument: (args) =>
    ipcRenderer.invoke("add-required-document", args),
  deleteRequiredDocument: (args) =>
    ipcRenderer.invoke("delete-required-document", args),
  updateDocumentCategory: (args) =>
    ipcRenderer.invoke("update-document-category", args),
  getDeletedRequiredDocuments: () =>
    ipcRenderer.invoke("get-deleted-required-documents"),
  restoreRequiredDocument: (args) =>
    ipcRenderer.invoke("restore-required-document", args),

  // File Dialog
  openFileDialog: (options) => ipcRenderer.invoke("open-file-dialog", options),

  // ZIP
  zipCandidateDocuments: (args) =>
    ipcRenderer.invoke("zip-candidate-documents", args),

  // =====================================================================
  // EMPLOYERS
  // =====================================================================
  getEmployers: () => ipcRenderer.invoke("get-employers"),
  addEmployer: (args) => ipcRenderer.invoke("add-employer", args),
  updateEmployer: (args) => ipcRenderer.invoke("update-employer", args),
  deleteEmployer: (args) => ipcRenderer.invoke("delete-employer", args),

  // =====================================================================
  // JOB ORDERS
  // =====================================================================
  getJobOrders: () => ipcRenderer.invoke("get-job-orders"),
  getJobOrderById: (data) => ipcRenderer.invoke("get-job-order-by-id", data),
  addJobOrder: (args) => ipcRenderer.invoke("add-job-order", args),
  updateJobOrder: (args) => ipcRenderer.invoke("update-job-order", args),
  deleteJobOrder: (args) => ipcRenderer.invoke("delete-job-order", args),

  // =====================================================================
  // PLACEMENTS
  // =====================================================================
  getCandidatePlacements: (args) =>
    ipcRenderer.invoke("get-candidate-placements", args),
  getUnassignedJobs: (args) => ipcRenderer.invoke("get-unassigned-jobs", args),
  assignCandidateToJob: (args) =>
    ipcRenderer.invoke("assign-candidate-to-job", args),
  removeCandidateFromJob: (args) =>
    ipcRenderer.invoke("remove-candidate-from-job", args),

  // =====================================================================
  // TRACKING MODULES
  // =====================================================================

  // Passport
  getPassportTracking: (args) =>
    ipcRenderer.invoke("get-passport-tracking", args),
  addPassportEntry: (args) => ipcRenderer.invoke("add-passport-entry", args),
  updatePassportEntry: (args) =>
    ipcRenderer.invoke("update-passport-entry", args),
  deletePassportEntry: (args) =>
    ipcRenderer.invoke("delete-passport-entry", args),

  // Visa
  getVisaTracking: (args) => ipcRenderer.invoke("get-visa-tracking", args),
  addVisaEntry: (args) => ipcRenderer.invoke("add-visa-entry", args),
  updateVisaEntry: (args) => ipcRenderer.invoke("update-visa-entry", args),
  deleteVisaEntry: (args) => ipcRenderer.invoke("delete-visa-entry", args),
  getAllActiveVisas: () => ipcRenderer.invoke("get-all-active-visas"),
  updateVisaStatus: (args) => ipcRenderer.invoke("update-visa-status", args),

  // Medical
  getMedicalTracking: (args) =>
    ipcRenderer.invoke("get-medical-tracking", args),
  addMedicalEntry: (args) => ipcRenderer.invoke("add-medical-entry", args),
  updateMedicalEntry: (args) =>
    ipcRenderer.invoke("update-medical-entry", args),
  deleteMedicalEntry: (args) =>
    ipcRenderer.invoke("delete-medical-entry", args),

  // Travel
  getTravelTracking: (args) =>
    ipcRenderer.invoke("get-travel-tracking", args),
  addTravelEntry: (args) => ipcRenderer.invoke("add-travel-entry", args),
  updateTravelEntry: (args) =>
    ipcRenderer.invoke("update-travel-entry", args),
  deleteTravelEntry: (args) =>
    ipcRenderer.invoke("delete-travel-entry", args),

  // Interview
  getInterviewTracking: (args) =>
    ipcRenderer.invoke("get-interview-tracking", args),
  addInterviewEntry: (args) => ipcRenderer.invoke("add-interview-entry", args),
  updateInterviewEntry: (args) =>
    ipcRenderer.invoke("update-interview-entry", args),
  deleteInterviewEntry: (args) =>
    ipcRenderer.invoke("delete-interview-entry", args),

  // =====================================================================
  // FINANCE
  // =====================================================================
  getCandidatePayments: (args) =>
    ipcRenderer.invoke("get-candidate-payments", args),
  addPayment: (args) => ipcRenderer.invoke("add-payment", args),
  updatePayment: (args) => ipcRenderer.invoke("update-payment", args),
  deletePayment: (args) => ipcRenderer.invoke("delete-payment", args),

  // =====================================================================
  // RECYCLE BIN
  // =====================================================================

  // Candidates
  getDeletedCandidates: () => ipcRenderer.invoke("get-deleted-candidates"),
  restoreCandidate: (args) => ipcRenderer.invoke("restore-candidate", args),

  // Employers
  getDeletedEmployers: () => ipcRenderer.invoke("get-deleted-employers"),
  restoreEmployer: (args) => ipcRenderer.invoke("restore-employer", args),

  // Job Orders
  getDeletedJobOrders: () => ipcRenderer.invoke("get-deleted-job-orders"),
  restoreJobOrder: (args) => ipcRenderer.invoke("restore-job-order", args),

  // Placements
  getDeletedPlacements: () => ipcRenderer.invoke("get-deleted-placements"),
  restorePlacement: (payload) =>
    ipcRenderer.invoke("restore-placement", payload),

  // Passports
  getDeletedPassports: () => ipcRenderer.invoke("get-deleted-passports"),
  restorePassport: (payload) =>
    ipcRenderer.invoke("restore-passport", payload),

  // Visas
  getDeletedVisas: () => ipcRenderer.invoke("get-deleted-visas"),
  restoreVisa: (payload) => ipcRenderer.invoke("restore-visa", payload),

  // Medical
  getDeletedMedical: () => ipcRenderer.invoke("get-deleted-medical"),
  restoreMedical: (payload) =>
    ipcRenderer.invoke("restore-medical", payload),

  // Interviews
  getDeletedInterviews: () => ipcRenderer.invoke("get-deleted-interviews"),
  restoreInterview: (payload) =>
    ipcRenderer.invoke("restore-interview", payload),

  // Travel
  getDeletedTravel: () => ipcRenderer.invoke("get-deleted-travel"),
  restoreTravel: (payload) => ipcRenderer.invoke("restore-travel", payload),

  // Permanent Delete
  deletePermanently: (payload) =>
    ipcRenderer.invoke("delete-permanently", payload),

  // =====================================================================
  // PDF / OFFER LETTER
  // =====================================================================

  readOfferTemplate: (args) => ipcRenderer.invoke("read-offer-template", args),
writeOfferTemplate: (args) => ipcRenderer.invoke("write-offer-template", args),

  generateOfferLetter: (args) =>    ipcRenderer.invoke("generate-offer-letter", args),
  printToPDF: (url) => ipcRenderer.invoke("print-to-pdf", url),

  // =====================================================================
  // COMMUNICATION
  // =====================================================================

  // WhatsApp
  sendWhatsAppBulk: (payload) =>    ipcRenderer.invoke("send-whatsapp-bulk", payload),
  openWhatsAppSingle: (payload) =>    ipcRenderer.invoke("open-whatsapp-single", payload),

  // Communication Logs
  logCommunication: (data) => ipcRenderer.invoke("logCommunication", data),
  getCommunicationLogs: (data) =>    ipcRenderer.invoke("getCommunicationLogs", data),
  getCommLogs: (args) => ipcRenderer.invoke("get-comm-logs", args),

  // =====================================================================
  // EMAIL SETTINGS
  // =====================================================================
  sendEmail: (args) => ipcRenderer.invoke("send-email", args),
  getSmtpSettings: () => ipcRenderer.invoke("get-smtp-settings"),
  saveSmtpSettings: (args) => ipcRenderer.invoke("save-smtp-settings", args),
  testSmtpConnection: (args) =>    ipcRenderer.invoke("test-smtp-connection", args),

  // =====================================================================
  // INTELLIGENCE (OCR / AI)
  // =====================================================================
  scanPassport: (params) => ipcRenderer.invoke("ocr-scan-passport", params),
  ocrScanPassport: (params) =>    ipcRenderer.invoke("ocr-scan-passport", params),

  // =====================================================================
  // CLOUD SYNC / BACKUP
  // =====================================================================
  initCloudSync: (provider, config) =>    ipcRenderer.invoke("init-cloud-sync", provider, config),
  testCloudConnection: (provider, config) =>
    ipcRenderer.invoke("test-cloud-connection", provider, config),

  createBackup: () => ipcRenderer.invoke("create-backup"),
  createLocalBackup: (path) =>    ipcRenderer.invoke("create-local-backup", path),

  listBackups: () => ipcRenderer.invoke("list-backups"),
  getBackupDetails: (fileId) =>    ipcRenderer.invoke("get-backup-details", fileId),

  restoreBackup: (fileId) => ipcRenderer.invoke("restore-backup", fileId),
  restoreLocalBackup: (path) =>    ipcRenderer.invoke("restore-local-backup", path),

  deleteBackup: (fileId) => ipcRenderer.invoke("delete-backup", fileId),

  enableAutoSync: (schedule) =>    ipcRenderer.invoke("enable-auto-sync", schedule),
  disableAutoSync: () => ipcRenderer.invoke("disable-auto-sync"),
  getSyncStatus: () => ipcRenderer.invoke("get-sync-status"),

  exportDatabase: (destinationPath) =>    ipcRenderer.invoke("export-database", destinationPath),
  importDatabase: (sourcePath) =>    ipcRenderer.invoke("import-database", sourcePath),

  // =====================================================================
  // LICENSE
  // =====================================================================
  getLicenseStatus: () => ipcRenderer.invoke("license:get-status"),
  activateLicense: (args) => ipcRenderer.invoke("license:activate", args),
  requestActivationCode: () =>    ipcRenderer.invoke("request-activation-code"),

  getUserReminders: (params) =>    ipcRenderer.invoke("get-user-reminders", params),
  createReminder: (params) =>    ipcRenderer.invoke("create-reminder", params),

  // ====================================================================
// ENHANCED PASSPORT TRACKING API
// ====================================================================
getPassportMovements: (data) =>   ipcRenderer.invoke("get-passport-movements", data),
addPassportMovement: (data) =>   ipcRenderer.invoke("add-passport-movement", data),
deletePassportMovement: (data) =>   ipcRenderer.invoke("delete-passport-movement", data),
addPassportMovementPhoto: (data) =>   ipcRenderer.invoke("add-passport-movement-photo", data),
getPassportMovementPhotos: (data) =>   ipcRenderer.invoke("get-passport-movement-photos", data),
deletePassportMovementPhoto: (data) =>   ipcRenderer.invoke("delete-passport-movement-photo", data),
getUsers: (data) => ipcRenderer.invoke('get-users', data),
deletePassportMovement: ({ movementId, user }) =>    ipcRenderer.invoke('delete-passport-movement', { movementId, user }),

backupDatabase: (user, destinationPath) =>     ipcRenderer.invoke('backupDatabase', { user, destinationPath }),
  showSaveDialog: (options) => 
    ipcRenderer.invoke('showSaveDialog', options),

  // Notifications
getNotifications: (args) => ipcRenderer.invoke('get-notifications', args),
markNotificationAsRead: (args) => ipcRenderer.invoke('mark-notification-as-read', args),
markAllNotificationsAsRead: () => ipcRenderer.invoke('mark-all-notifications-as-read'),
deleteNotification: (args) => ipcRenderer.invoke('delete-notification', args),
clearAllNotifications: () => ipcRenderer.invoke('clear-all-notifications'),
createNotification: (data) => ipcRenderer.invoke('create-notification', data),

onNotification: (callback) => {  const handler = (_event, data) => callback(data);
  ipcRenderer.on('notification-created', handler);
  return () => ipcRenderer.removeListener('notification-created', handler);


  

},


});

/**
 * ============================================================
 * UI PERMISSION VISIBILITY (OPTIONAL - FOR FUTURE USE)
 * ============================================================
 */
contextBridge.exposeInMainWorld("permission", {
  can: async (feature) => {
    try {
      const res = await ipcRenderer.invoke("ui-can-access", { feature });
      return !!res?.allowed;
    } catch {
      return false;
    }
  },
  getRole: async (userId) => {
    try {
      const res = await ipcRenderer.invoke("get-user-role", { userId });
      return res?.role || null;
    } catch {
      return null;
    }
  },
});
