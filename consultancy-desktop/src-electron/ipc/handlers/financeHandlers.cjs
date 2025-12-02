const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerFinanceHandlers() {

    // =========================================================================
    // 🔹 GET ALL PAYMENTS FOR A CANDIDATE
    // =========================================================================
    ipcMain.handle("get-candidate-payments", async (event, { user, candidateId }) => {
        if (user) {
            logAction(
                user,
                "view_candidate_finance",
                "finance",
                candidateId,
                `Viewed payments`
            );
        }
        return queries.getCandidatePayments(candidateId);
    });

    // =========================================================================
    // 🔹 ADD PAYMENT ENTRY
    // =========================================================================
    ipcMain.handle("add-payment", async (event, { user, data }) => {
        const result = await queries.addPayment(user, data);

        if (result.success) {
            logAction(
                user,
                "add_payment",
                "finance",
                data.candidate_id,
                `Amount: ${data.amount_paid}, Status: ${data.status}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 UPDATE PAYMENT
    // =========================================================================
    ipcMain.handle("update-payment", async (event, { user, id, amount_paid, status }) => {

        const updateData = {
            id,
            amount_paid,
            status,
            user
        };

        const result = await queries.updatePayment(updateData);

        if (result.success) {
            logAction(
                user,
                "update_payment",
                "finance",
                result.candidateId,
                `Updated payment ID ${id}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 DELETE PAYMENT
    // =========================================================================
    ipcMain.handle("delete-payment", async (event, { user, id }) => {
        const result = await queries.deletePayment(user, id);

        if (result.success) {
            logAction(
                user,
                "delete_payment",
                "finance",
                result.candidateId,
                `Deleted payment ID ${id}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 GET FULL FINANCIAL SUMMARY FOR CANDIDATE
    // =========================================================================
    ipcMain.handle("get-candidate-finance", async (event, { user, candidateId }) => {
        if (user && user.id) {
            logAction(
                user,
                "view_candidate_finance",
                "finance",
                candidateId,
                `Viewed finance summary`
            );
        }

        return queries.getCandidateFinance(candidateId);
    });

};
