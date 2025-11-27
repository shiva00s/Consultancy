const { app, BrowserWindow, dialog } = require('electron'); // --- ADDED 'dialog' ---
const path = require('path');
const { initializeDatabase } = require('./src-electron/db/database.cjs'); 
const { registerIpcHandlers } = require('./src-electron/ipc/handlers.cjs'); 
const { startServer } = require('./src-electron/server/api.cjs');

// --- Window Creation (No changes here) ---
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true, // This MUST be true
    },
  });

  if (process.env.NODE_ENV === 'production') {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  }
}

// --- App Lifecycle ---
app.whenReady().then(async () => {
  try {
    // 1. Wait for the database to connect and setup
    await initializeDatabase();
    
   // 2. Once the DB is ready, register all our API endpoints
    registerIpcHandlers(app); // --- MODIFIED: Pass the app object ---
    startServer();
    // 3. Create the app window
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- ALL API AND DATABASE LOGIC IS NOW REMOVED FROM THIS FILE ---
// --- It all lives in src-electron/ ---