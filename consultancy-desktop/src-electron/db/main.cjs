const { machineIdSync } = require('node-machine-id');
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const dataDir = app.getPath('userData');
const licenseFile = path.join(dataDir, 'license.json');

function getMachineInfo() {
  const id = machineIdSync(); // stable per OS install
  return id;
}

function isActivated() {
  try {
    const raw = fs.readFileSync(licenseFile, 'utf8');
    const data = JSON.parse(raw);
    return data && data.activated === true;
  } catch {
    return false;
  }
}

function saveActivation(code) {
  fs.writeFileSync(
    licenseFile,
    JSON.stringify({ activated: true, code }, null, 2),
    'utf8'
  );
}

// IPC
ipcMain.handle('license:get-status', () => ({
  success: true,
  data: {
    activated: isActivated(),
    machineId: getMachineInfo(),
  },
}));

ipcMain.handle('license:activate', async (event, { code }) => {
  const machineId = getMachineInfo();

  // TODO: replace with your real server/API check.
  // For now: simple hard rule (example).
  const expected = (machineId.slice(0, 6).toUpperCase()); // demo logic
  if (code !== expected) {
    return { success: false, error: 'Invalid activation code.' };
  }

  saveActivation(code);
  return { success: true };
});
