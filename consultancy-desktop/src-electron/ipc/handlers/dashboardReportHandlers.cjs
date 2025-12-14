const registerDashboardReportHandlers = (ipcMain, dependencies) => {
    const { queries, logAction } = dependencies;

    // Existing Handlers
    ipcMain.handle('get-reporting-data', (event, { user, filters = {} } = {}) => {
        return queries.getReportingData(user, filters);
    });

    ipcMain.handle('get-detailed-report-list', (event, { user, status, employer }) => {
        return queries.getDetailedReportList(user, { status, employer });
    });

    // NEW: Advanced Report Handlers
    ipcMain.handle('get-candidate-timeline-report', async (event, { user, filters = {} }) => {
        const result = await queries.getCandidateTimelineReport(user, filters);
        if (result.success) {
            logAction(user, 'view_timeline_report', 'reports', 1, `Filters: ${JSON.stringify(filters)}`);
        }
        return result;
    });

    ipcMain.handle('get-financial-summary-report', async (event, { user, filters = {} }) => {
        const result = await queries.getFinancialSummaryReport(user, filters);
        if (result.success) {
            logAction(user, 'view_financial_report', 'reports', 1, `Filters: ${JSON.stringify(filters)}`);
        }
        return result;
    });

    ipcMain.handle('get-visa-processing-report', async (event, { user, filters = {} }) => {
        const result = await queries.getVisaProcessingReport(user, filters);
        if (result.success) {
            logAction(user, 'view_visa_report', 'reports', 1, `Filters: ${JSON.stringify(filters)}`);
        }
        return result;
    });

    ipcMain.handle('get-employer-performance-report', async (event, { user, filters = {} }) => {
        const result = await queries.getEmployerPerformanceReport(user, filters);
        if (result.success) {
            logAction(user, 'view_employer_report', 'reports', 1, `Filters: ${JSON.stringify(filters)}`);
        }
        return result;
    });

    ipcMain.handle('get-document-compliance-report', async (event, { user }) => {
        const result = await queries.getDocumentComplianceReport(user);
        if (result.success) {
            logAction(user, 'view_compliance_report', 'reports', 1);
        }
        return result;
    });
};

module.exports = { registerDashboardReportHandlers };
