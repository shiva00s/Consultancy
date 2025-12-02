//
// handlers.cjs
// The MAIN HANDLER REGISTRAR for your entire Electron Backend
//

// ---------------------------------------------------------------------------
// IMPORT ALL HANDLER MODULES
// Each module contains IPC handlers for one domain only
// ---------------------------------------------------------------------------

const registerCandidateHandlers = require("./handlers/candidateHandlers.cjs");
const registerEmployerHandlers = require("./handlers/employerHandlers.cjs");
const registerJobOrderHandlers = require("./handlers/jobOrderHandlers.cjs");
const registerPlacementHandlers = require("./handlers/placementHandlers.cjs");

// Tracking Modules
const registerPassportHandlers = require("./handlers/passportHandlers.cjs");
const registerVisaHandlers = require("./handlers/visaHandlers.cjs");
const registerMedicalHandlers = require("./handlers/medicalHandlers.cjs");
const registerInterviewHandlers = require("./handlers/interviewHandlers.cjs");
const registerTravelHandlers = require("./handlers/travelHandlers.cjs");

// Document Modules
const registerDocumentCategoryHandlers = require("./handlers/documentCategoryHandlers.cjs");
const registerRequiredDocumentHandlers = require("./handlers/requiredDocumentHandlers.cjs");

// Intelligence + Activation
const registerOcrHandlers = require("./handlers/ocrHandlers.cjs");
const registerLicenseHandlers = require("./handlers/licenseHandlers.cjs");

// Finance + Email + Recycle Bin
const registerRecycleBinHandlers = require("./handlers/recycleBinHandlers.cjs");
const registerEmailHandlers = require("./handlers/emailHandlers.cjs");
const registerFinanceHandlers = require("./handlers/financeHandlers.cjs");

// Communication + Mobile + Secure FS
const registerCommunicationHandlers = require("./handlers/communicationHandlers.cjs");
const registerMobileDocumentHandlers = require("./handlers/mobileDocumentHandlers.cjs");
const registerSecureFileHandlers = require("./handlers/secureFileHandlers.cjs");

// Dashboard + Flags + Kanban
const registerReportingHandlers = require("./handlers/reportingHandlers.cjs");
const registerFeatureFlagHandlers = require("./handlers/featureFlagHandlers.cjs");
const registerVisaKanbanHandlers = require("./handlers/visaKanbanHandlers.cjs");

// ---------------------------------------------------------------------------
// EXPORT MAIN FUNCTION TO REGISTER ALL HANDLERS
// ---------------------------------------------------------------------------

module.exports = function registerAllIpcHandlers() {

    // Core Entities
    registerCandidateHandlers();
    registerEmployerHandlers();
    registerJobOrderHandlers();
    registerPlacementHandlers();

    // Tracking Modules
    registerPassportHandlers();
    registerVisaHandlers();
    registerMedicalHandlers();
    registerInterviewHandlers();
    registerTravelHandlers();

    // Document Modules
    registerDocumentCategoryHandlers();
    registerRequiredDocumentHandlers();

    // OCR + Licensing
    registerOcrHandlers();
    registerLicenseHandlers();

    // Financial + Email + Bin
    registerRecycleBinHandlers();
    registerEmailHandlers();
    registerFinanceHandlers();

    // Communication + Mobile FS
    registerCommunicationHandlers();
    registerMobileDocumentHandlers();
    registerSecureFileHandlers();

    // Reporting + Flags + Kanban
    registerReportingHandlers();
    registerFeatureFlagHandlers();
    registerVisaKanbanHandlers();

    console.log("✔ ALL IPC HANDLERS REGISTERED SUCCESSFULLY");
};
