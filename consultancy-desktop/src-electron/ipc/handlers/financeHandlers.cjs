const registerFinanceHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('get-candidate-payments', (event, { candidateId }) => {
        return queries.getCandidatePayments(candidateId);
    });

    ipcMain.handle('add-payment', async (event, { user, data }) => {
        const result = await queries.addPayment(user, data);
        if (result.success) {
            logAction(user, 'add_payment', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Desc: ${data.description}, Amount: ${data.amount_paid}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('update-payment', async (event, { user, id, amount_paid, status }) => {
        const updateData = { user, id, amount_paid, status };
        
        const result = await queries.updatePayment(updateData);
        
        if (result.success) {
            logAction(user, 'update_payment', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Desc: ${result.description}, Amount: ${amount_paid}, Status: ${status}`);
        }
        
        return result;
    });

    ipcMain.handle('delete-payment', async (event, { user, id }) => {
        const result = await queries.deletePayment(user, id);
        if (result.success) {
            logAction(user, 'delete_payment', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Desc: ${result.description}, Amount: ${result.total_amount}`);
        }
        return result;
    });
};

module.exports = { registerFinanceHandlers };
