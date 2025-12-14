//
// handlers/index.js
// Loads ALL handler modules in one clean place
//

const registerCandidateHandlers = require("./candidateHandlers.cjs");
const registerEmployerHandlers = require("./employerHandlers.cjs");
const registerJobOrderHandlers = require("./jobOrderHandlers.cjs");
const registerPlacementHandlers = require("./placementHandlers.cjs");

const registerPassportHandlers = require("./passportHandlers.cjs");
const registerVisaHandlers = require("./visaHandlers.cjs");
const registerMedicalHandlers = require("./medicalHandlers.cjs");
const registerInterviewHandlers = require("./interviewHandlers.cjs");
const registerTravelHandlers = require("./travelHandlers.cjs");

const registerDocumentCategoryHandlers = require("./documentCategoryHandlers.cjs");
const registerRequiredDocumentHandlers = require("./requiredDocumentHandlers.cjs");

const registerOcrHandlers = require("./ocrHandlers.cjs");
const registerLicenseHandlers = require("./licenseHandlers.cjs");

const registerRecycleBinHandlers = require("./recycleBinHandlers.cjs");
const registerEmailHandlers = require("./emailHandlers.cjs");
const registerFinanceHandlers = require("./financeHandlers.cjs");

const registerCommunicationHandlers = require("./communicationHandlers.cjs");
const registerVisaKanbanHandlers = require("./visaKanbanHandlers.cjs");

const registerSecureFileHandlers = require("./secureFileHandlers.cjs");
const registerMobileDocumentHandlers = require("./mobileDocumentHandlers.cjs");

const registerReportingHandlers = require("./reportingHandlers.cjs");
const registerFeatureFlagHandlers = require("./featureFlagHandlers.cjs");

module.exports = function registerAllHandlers() {
    
    // Core Candidate Lifecycle
    registerCandidateHandlers();
    registerEmployerHandlers();
    registerJobOrderHandlers();
    registerPlacementHandlers();

    // Processing Pipeline (Tracking)
    registerPassportHandlers();
    registerVisaHandlers();
    registerMedicalHandlers();
    registerInterviewHandlers();
    registerTravelHandlers();

    // Document Management Masters
    registerDocumentCategoryHandlers();
    registerRequiredDocumentHandlers();

    // Intelligence + Activation
    registerOcrHandlers();
    registerLicenseHandlers();

    // Recycle Bin + Email + Finance
    registerRecycleBinHandlers();
    registerEmailHandlers();
    registerFinanceHandlers();

    // Communication Logs
    registerCommunicationHandlers();

    // Kanban
    registerVisaKanbanHandlers();

    // Secure FS Access + Mobile
    registerSecureFileHandlers();
    registerMobileDocumentHandlers();

    // Reporting + Feature Flags
    registerReportingHandlers();
    registerFeatureFlagHandlers();

    console.log("ALL HANDLERS REGISTERED ✔");
};
