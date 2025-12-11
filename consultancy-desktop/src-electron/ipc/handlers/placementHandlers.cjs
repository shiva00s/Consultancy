const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerPlacementHandlers() {

    // =========================================================================
    // 🔹 GET ALL PLACEMENTS FOR A CANDIDATE
    // =========================================================================
    ipcMain.handle("get-candidate-placements", async (event, { candidateId }) => {
        return queries.getCandidatePlacements(candidateId);
    });

    // =========================================================================
    // 🔹 GET JOBS NOT YET ASSIGNED TO THIS CANDIDATE
    // =========================================================================
    ipcMain.handle("get-unassigned-jobs", async (event, { candidateId }) => {
        return queries.getUnassignedJobs(candidateId);
    });

    // =========================================================================
    // 🔹 ASSIGN CANDIDATE TO JOB
    // =========================================================================
    ipcMain.handle("assign-candidate-to-job", async (event, { user, candidateId, jobId }) => {
        const result = await queries.assignCandidateToJob(candidateId, jobId);

        if (result.success) {
            logAction(
                user,
                "assign_job",
                "placements",
                result.placementId || 0,
                `Candidate ${candidateId} -> Job ${jobId}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 REMOVE CANDIDATE FROM JOB (DELETE PLACEMENT)
    // =========================================================================
    ipcMain.handle("remove-candidate-from-job", async (event, { user, placementId }) => {
        const result = await queries.removeCandidateFromJob(placementId);

        if (result.success) {
            logAction(
                user,
                "remove_placement",
                "placements",
                placementId,
                `Candidate ${result.candidateId} removed from Job ${result.jobId}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 RECYCLE BIN: GET DELETED PLACEMENTS
    // =========================================================================
    ipcMain.handle("get-deleted-placements", async () => {
        return queries.getDeletedPlacements();
    });

    // =========================================================================
    // 🔹 RESTORE PLACEMENT FROM RECYCLE BIN
    // =========================================================================
    ipcMain.handle("restore-placement", async (event, { user, id }) => {
        const result = await queries.restorePlacement(id);

        if (result.success) {
            logAction(user, "restore_placement", "placements", id);
        }

        return result;
    });

    // =========================================================================
    // 🔹 PERMANENT DELETE PLACEMENT (SUPER ADMIN)
    // =========================================================================
    ipcMain.handle("delete-placement-permanently", async (event, { user, id }) => {
        if (!user || user.role !== "super_admin") {
            return { success: false, error: "Access Denied" };
        }

        const result = await queries.deletePlacementPermanently(id);

        if (result.success) {
            logAction(user, "permanent_delete", "placements", id);
        }

        return result;
    });

};
