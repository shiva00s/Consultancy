const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

module.exports = function registerReportingHandlers() {

    // =========================================================================
    // 🔹 GENERATE CUSTOM REPORT (Excel)
    // =========================================================================
    ipcMain.handle("generate-report", async (event, { filters, outputPath }) => {
        try {
            const result = await queries.generateReport(filters);

            if (!result.success) {
                return result;
            }

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Report");

            if (result.columns) {
                sheet.addRow(result.columns);
            }

            result.rows.forEach((row) => {
                sheet.addRow(Object.values(row));
            });

            await workbook.xlsx.writeFile(outputPath);

            return { success: true, path: outputPath };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 EXPORT CANDIDATE LIST (Excel)
    // =========================================================================
    ipcMain.handle("export-candidate-list", async (event, { candidates, outputPath }) => {
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Candidates");

            if (candidates.length > 0) {
                sheet.addRow(Object.keys(candidates[0]));
            }

            candidates.forEach((row) => {
                sheet.addRow(Object.values(row));
            });

            await workbook.xlsx.writeFile(outputPath);

            return { success: true, path: outputPath };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 ANALYTICS SUMMARY (Dashboard counts)
    // =========================================================================
    ipcMain.handle("analytics-summary", async () => {
        return queries.getAnalyticsSummary();
    });

    // =========================================================================
    // 🔹 DASHBOARD STATS (Candidates, Jobs, Employers, Visa, Passport)
    // =========================================================================
    ipcMain.handle("get-dashboard-stats", async () => {
        return queries.getDashboardStats();
    });

};
