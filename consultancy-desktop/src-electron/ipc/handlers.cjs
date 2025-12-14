// src-electron/ipc/handlers.cjs
const { registerAuthHandlers } = require('./modules/authHandlers.cjs');
const { registerCandidateHandlers } = require('./modules/candidateHandlers.cjs');
const { registerEmployerHandlers } = require('./modules/employerHandlers.cjs');
const { registerJobOrderHandlers } = require('./modules/jobOrderHandlers.cjs');
const { registerPlacementHandlers } = require('./modules/placementHandlers.cjs');
const { registerVisaHandlers } = require('./modules/visaHandlers.cjs');
const { registerMedicalHandlers } = require('./modules/medicalHandlers.cjs');
const { registerTravelHandlers } = require('./modules/travelHandlers.cjs');
const { registerInterviewHandlers } = require('./modules/interviewHandlers.cjs');
const { registerFinancialHandlers } = require('./modules/financialHandlers.cjs');
const { registerRecycleBinHandlers } = require('./modules/recycleBinHandlers.cjs');
const { registerFileSystemHandlers } = require('./modules/fileSystemHandlers.cjs');
const { registerEmailHandlers } = require('./modules/emailHandlers.cjs');
const { registerSystemHandlers } = require('./modules/systemHandlers.cjs');
const { registerAuditHandlers } = require('./modules/auditHandlers.cjs');
const { registerOCRHandlers } = require('./modules/ocrHandlers.cjs');
const { registerAnalyticsHandlers } = require('./analyticsHandlers.cjs');
const { registerDocumentHandlers } = require('./documentHandlers.cjs');
const { registerSyncHandlers } = require('./syncHandlers.cjs');
const { registerPermissionHandlers } = require('../utils/permissionHandlers.cjs');
const { getDatabase } = require('../db/database.cjs');

function registerIpcHandlers(app) {
    const db = getDatabase();
    
    if (!db) {
        console.error('❌ Database is not initialized. Handlers will not be registered.');
        return;
    }

    console.log('📡 Registering IPC Handlers...');

    // Core Handlers
    registerAuthHandlers(app);
    registerSystemHandlers(app);
    registerAuditHandlers(app);
    
    // Entity Handlers
    registerCandidateHandlers(app);
    registerEmployerHandlers(app);
    registerJobOrderHandlers(app);
    registerPlacementHandlers(app);
    
    // Sub-Module Handlers
    registerVisaHandlers(app);
    registerMedicalHandlers(app);
    registerTravelHandlers(app);
    registerInterviewHandlers(app);
    registerFinancialHandlers(app);
    
    // Utility Handlers
    registerRecycleBinHandlers(app);
    registerFileSystemHandlers(app);
    registerEmailHandlers(app);
    registerOCRHandlers(app);
    
    // External Module Handlers
    registerAnalyticsHandlers();
    registerDocumentHandlers();
    registerSyncHandlers();
    registerPermissionHandlers();

    console.log('✅ All IPC Handlers Registered Successfully');
}

module.exports = { registerIpcHandlers };
