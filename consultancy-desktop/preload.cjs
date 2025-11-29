const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {

    
    // --------------------------
    // SYSTEM
    // --------------------------
    showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
    showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
    backupDatabase: (args) => ipcRenderer.invoke("backup-database", args),
    getActivationStatus: () => ipcRenderer.invoke("get-activation-status"),

    // --------------------------
    // LOGIN / USERS
    // --------------------------
    login: (args) => ipcRenderer.invoke("login", args),
    registerNewUser: (args) => ipcRenderer.invoke("register-new-user", args),
    getAllUsers: () => ipcRenderer.invoke("get-all-users"),
    addUser: (args) => ipcRenderer.invoke("add-user", args),
    resetUserPassword: (args) => ipcRenderer.invoke("reset-user-password", args),
    changeMyPassword: (args) => ipcRenderer.invoke("change-my-password", args),
    deleteUser: (args) => ipcRenderer.invoke("delete-user", args),

    getUserPermissions: (args) => ipcRenderer.invoke("get-user-permissions", args),
    saveUserPermissions: (args) => ipcRenderer.invoke("save-user-permissions", args),

    // --------------------------
    // FEATURE FLAGS
    // --------------------------
    getFeatureFlags: () => ipcRenderer.invoke("get-feature-flags"),
    saveFeatureFlags: (args) => ipcRenderer.invoke("save-feature-flags", args),

    // --------------------------
    // REPORTING
    // --------------------------
    getReportingData: (args) => ipcRenderer.invoke("get-reporting-data", args),
    getSystemAuditLog: (args) => ipcRenderer.invoke("get-system-audit-log", args),
    getAuditLogForCandidate: (args) => ipcRenderer.invoke("get-audit-log-for-candidate", args),

    // ❗ THIS ONE WILL WORK ONLY IF YOU ADD HANDLER IN MAIN
    getDetailedReportList: (args) => ipcRenderer.invoke("get-detailed-report-list", args),

    // --------------------------
    // CANDIDATES
    // --------------------------
    searchCandidates: (args) => ipcRenderer.invoke("search-candidates", args),
    getCandidateDetails: (args) => ipcRenderer.invoke("get-candidate-details", args),
    saveCandidateMulti: (args) => ipcRenderer.invoke("save-candidate-multi", args),
    updateCandidateText: (args) => ipcRenderer.invoke("update-candidate-text", args),
    deleteCandidate: (args) => ipcRenderer.invoke("delete-candidate", args),

    addDocuments: (args) => ipcRenderer.invoke("add-documents", args),
    deleteDocument: (args) => ipcRenderer.invoke("delete-document", args),
    getImageBase64: (params) => ipcRenderer.invoke('getImageBase64', params),
    getRequiredDocuments: () => ipcRenderer.invoke("get-required-documents"),
    addRequiredDocument: (args) => ipcRenderer.invoke("add-required-document", args),
    deleteRequiredDocument: (args) => ipcRenderer.invoke("delete-required-document", args),
    updateDocumentCategory: (args) => ipcRenderer.invoke("update-document-category", args),
    openFileExternally: (args) => ipcRenderer.invoke("open-file-externally", args),
    getDocumentBase64: (args) => ipcRenderer.invoke("get-document-base64", args),
    readAbsoluteFileBuffer: (params) => ipcRenderer.invoke("read-absolute-file-buffer", params),
    readAbsoluteFileBuffer: (data) => ipcRenderer.invoke('readAbsoluteFileBuffer', data),

    // Bulk Import
    getCSVHeaders: (args) => ipcRenderer.invoke("get-csv-headers", args),
    importCandidatesFromFile: (args) => ipcRenderer.invoke("import-candidates-from-file", args),
    getExcelSheets: (args) => ipcRenderer.invoke("get-excel-sheets", args),
    getExcelHeaders: (args) => ipcRenderer.invoke("get-excel-headers", args),
    importCandidatesFromExcel: (args) => ipcRenderer.invoke("import-candidates-from-excel", args),
    downloadExcelTemplate: () => ipcRenderer.invoke("download-excel-template"),
    downloadImportErrors: (args) => ipcRenderer.invoke("download-import-errors", args),
    getCSVHeaders: (args) => ipcRenderer.invoke("get-csv-headers", args),

    // --------------------------
    // EMPLOYERS
    // --------------------------
    getEmployers: () => ipcRenderer.invoke("get-employers"),
    addEmployer: (args) => ipcRenderer.invoke("add-employer", args),
    updateEmployer: (args) => ipcRenderer.invoke("update-employer", args),
    deleteEmployer: (args) => ipcRenderer.invoke("delete-employer", args),

    // --------------------------
    // JOBS
    // --------------------------
    getJobOrders: () => ipcRenderer.invoke("get-job-orders"),
    addJobOrder: (args) => ipcRenderer.invoke("add-job-order", args),
    updateJobOrder: (args) => ipcRenderer.invoke("update-job-order", args),
    deleteJobOrder: (args) => ipcRenderer.invoke("delete-job-order", args),

    // --------------------------
    // PLACEMENTS
    // --------------------------
    getCandidatePlacements: (args) => ipcRenderer.invoke("get-candidate-placements", args),
    getUnassignedJobs: (args) => ipcRenderer.invoke("get-unassigned-jobs", args),
    assignCandidateToJob: (args) => ipcRenderer.invoke("assign-candidate-to-job", args),
    removeCandidateFromJob: (args) => ipcRenderer.invoke("remove-candidate-from-job", args),

    // --------------------------
    // TRACKING MODULES
    // --------------------------
    getPassportTracking: (args) => ipcRenderer.invoke("get-passport-tracking", args),
    addPassportEntry: (args) => ipcRenderer.invoke("add-passport-entry", args),

    getVisaTracking: (args) => ipcRenderer.invoke("get-visa-tracking", args),
    addVisaEntry: (args) => ipcRenderer.invoke("add-visa-entry", args),
    updateVisaEntry: (args) => ipcRenderer.invoke("update-visa-entry", args),
    deleteVisaEntry: (args) => ipcRenderer.invoke("delete-visa-entry", args),

    getMedicalTracking: (args) => ipcRenderer.invoke("get-medical-tracking", args),
    addMedicalEntry: (args) => ipcRenderer.invoke("add-medical-entry", args),
    updateMedicalEntry: (args) => ipcRenderer.invoke("update-medical-entry", args),
    deleteMedicalEntry: (args) => ipcRenderer.invoke("delete-medical-entry", args),

    getTravelTracking: (args) => ipcRenderer.invoke("get-travel-tracking", args),
    addTravelEntry: (args) => ipcRenderer.invoke("add-travel-entry", args),
    updateTravelEntry: (args) => ipcRenderer.invoke("update-travel-entry", args),
    deleteTravelEntry: (args) => ipcRenderer.invoke("delete-travel-entry", args),

    getInterviewTracking: (args) => ipcRenderer.invoke("get-interview-tracking", args),
    addInterviewEntry: (args) => ipcRenderer.invoke("add-interview-entry", args),
    updateInterviewEntry: (args) => ipcRenderer.invoke("update-interview-entry", args),
    deleteInterviewEntry: (args) => ipcRenderer.invoke("delete-interview-entry", args),
    

    // --------------------------
    // FINANCE
    // --------------------------
    getCandidatePayments: (args) => ipcRenderer.invoke("get-candidate-payments", args),
    addPayment: (args) => ipcRenderer.invoke("add-payment", args),
    updatePayment: (args) => ipcRenderer.invoke("update-payment", args),
    deletePayment: (args) => ipcRenderer.invoke("delete-payment", args),

    // --------------------------
    // RECYCLE BIN
    // --------------------------
    getDeletedCandidates: () => ipcRenderer.invoke("get-deleted-candidates"), // <-- CRITICAL FIX
    restoreCandidate: (args) => ipcRenderer.invoke("restore-candidate", args),
    getDeletedEmployers: () => ipcRenderer.invoke("get-deleted-employers"), // <-- Check for other missing handlers
    restoreEmployer: (args) => ipcRenderer.invoke("restore-employer", args),
    getDeletedJobOrders: () => ipcRenderer.invoke("get-deleted-job-orders"), // <-- Check for other missing handlers
    restoreJobOrder: (args) => ipcRenderer.invoke("restore-job-order", args),
    deletePermanently: (args) => ipcRenderer.invoke("delete-permanently", args),

addDocuments: (args) => ipcRenderer.invoke("add-documents", args),
deleteDocument: (args) => ipcRenderer.invoke("delete-document", args),
getImageBase64: (params) => ipcRenderer.invoke('getImageBase64', params),
getRequiredDocuments: () => ipcRenderer.invoke("get-required-documents"),
addRequiredDocument: (args) => ipcRenderer.invoke("add-required-document", args),
deleteRequiredDocument: (args) => ipcRenderer.invoke("delete-required-document", args),
updateDocumentCategory: (args) => ipcRenderer.invoke("update-document-category", args),
openFileExternally: (args) => ipcRenderer.invoke("open-file-externally", args),
getDocumentBase64: (args) => ipcRenderer.invoke("get-document-base64", args),
readAbsoluteFileBuffer: (params) => ipcRenderer.invoke("read-absolute-file-buffer", params),

    // --------------------------
    // PDF / TEMPLATE
    // --------------------------
    readOfferTemplate: () => ipcRenderer.invoke("read-offer-template"),
    writeOfferTemplate: (args) => ipcRenderer.invoke("write-offer-template", args),
    generateOfferLetter: (args) => ipcRenderer.invoke("generate-offer-letter", args),
    printToPDF: (url) => ipcRenderer.invoke("print-to-pdf", url),

    // --------------------------
    // ZIP EXPORT
    // --------------------------
    zipCandidateDocuments: (args) => ipcRenderer.invoke("zip-candidate-documents", args),

    // --------------------------
    // EMAIL
    // --------------------------
    sendEmail: (args) => ipcRenderer.invoke("send-email", args),
    getSmtpSettings: (args) => ipcRenderer.invoke("get-smtp-settings", args),
    saveSmtpSettings: (args) => ipcRenderer.invoke("save-smtp-settings", args),

    // Intelligence
    scanPassport: (params) => ipcRenderer.invoke('ocr-scan-passport', params),
    ocrScanPassport: (data) => ipcRenderer.invoke('ocr-scan-passport', data),
   
    // --------------------------
    // MOBILE SERVER INFO
    // --------------------------
    getServerIP: () => ipcRenderer.invoke("get-server-ip"),
    getMachineId: () => ipcRenderer.invoke("get-machine-id"), // <-- NEW
    activateApplication: (args) => ipcRenderer.invoke("activate-application", args), // <-- NEW
    
    logCommunication: (args) => ipcRenderer.invoke("log-communication", args),
    getCommLogs: (args) => ipcRenderer.invoke("get-comm-logs", args),

   getSecureFilePath: (args) => ipcRenderer.invoke("get-secure-file-path", args),
    updatePassportEntry: (args) => ipcRenderer.invoke("update-passport-entry", args),
    deletePassportEntry: (args) => ipcRenderer.invoke("delete-passport-entry", args),
    testSmtpConnection: (args) => ipcRenderer.invoke('test-smtp-connection', args),
    getUserRole: (args) => ipcRenderer.invoke('get-user-role', args),
    restoreDatabase: (args) => ipcRenderer.invoke('restore-database', args),
getAllActiveVisas: () => ipcRenderer.invoke('get-all-active-visas'),
  updateVisaStatus: (args) => ipcRenderer.invoke('update-visa-status', args),

getAdvancedAnalytics: (timeRange) => ipcRenderer.invoke('get-advanced-analytics', timeRange),
  exportAnalytics: (format) => ipcRenderer.invoke('export-analytics', format),

// Document Management APIs
  uploadDocument: (data) => ipcRenderer.invoke('upload-document', data),
  getCandidateDocuments: (candidateId) => ipcRenderer.invoke('get-candidate-documents', candidateId),
  downloadDocument: (documentId) => ipcRenderer.invoke('download-document', documentId),
  deleteDocument: (documentId) => ipcRenderer.invoke('delete-document', documentId),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  uploadResume: (data) => ipcRenderer.invoke('upload-resume', data),
  uploadPhoto: (data) => ipcRenderer.invoke('upload-photo', data),

// Cloud Sync APIs
  initCloudSync: (provider, config) => ipcRenderer.invoke('init-cloud-sync', provider, config),
  createBackup: () => ipcRenderer.invoke('create-backup'),
  createLocalBackup: (destinationPath) => ipcRenderer.invoke('create-local-backup', destinationPath),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (fileId) => ipcRenderer.invoke('restore-backup', fileId),
  restoreLocalBackup: (backupPath) => ipcRenderer.invoke('restore-local-backup', backupPath),
  enableAutoSync: (schedule) => ipcRenderer.invoke('enable-auto-sync', schedule),
  disableAutoSync: () => ipcRenderer.invoke('disable-auto-sync'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  testCloudConnection: (provider, config) => ipcRenderer.invoke('test-cloud-connection', provider, config),
  deleteBackup: (fileId) => ipcRenderer.invoke('delete-backup', fileId),
  getBackupDetails: (fileId) => ipcRenderer.invoke('get-backup-details', fileId),
  exportDatabase: (destinationPath) => ipcRenderer.invoke('export-database', destinationPath),
  importDatabase: (sourcePath) => ipcRenderer.invoke('import-database', sourcePath),
bulkImportDocuments: (args) => ipcRenderer.invoke('bulk-import-documents', args),

aveCandidateMulti: (payload) =>
  ipcRenderer.invoke("save-candidate-multi", payload),

readAbsoluteFileBuffer: (data) =>
  ipcRenderer.invoke("read-absolute-file-buffer", data),






  
});