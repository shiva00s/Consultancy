const registerCommunicationLogHandlers = (ipcMain, dependencies) => {
    const { queries } = dependencies;

    ipcMain.handle('log-communication', (event, args) => queries.logCommunication(args.user, args.candidateId, args.type, args.details));
};

module.exports = { registerCommunicationLogHandlers };
