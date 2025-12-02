const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { initializeDatabase, closeDatabase } = require('./src-electron/db/database.cjs');
const { runMigrations } = require('./src-electron/db/migrations.cjs');
const { registerIpcHandlers } = require('./src-electron/ipc/handlers.cjs');
const { fileManager } = require('./src-electron/utils/fileManager.cjs');

// Try to load auto-updater
let AutoUpdater = null;
let hasAutoUpdater = false;

try {
  const updaterModule = require('./src-electron/utils/autoUpdater.cjs');
  AutoUpdater = updaterModule.AutoUpdater;
  hasAutoUpdater = updaterModule.hasElectronUpdater;
} catch (error) {
  console.log('⚠️ Auto-updater module not loaded:', error.message);
}

let mainWindow = null;
let updater = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  // Initialize auto-updater if available
  if (hasAutoUpdater && AutoUpdater) {
    try {
      updater = new AutoUpdater(mainWindow);
      
      // Check for updates after 5 seconds
      setTimeout(() => {
        if (updater) {
          updater.checkForUpdatesAndNotify();
        }
      }, 5000);
    } catch (error) {
      console.error('❌ Failed to initialize auto-updater:', error);
    }
  }

  // Load app
  if (process.env.NODE_ENV === 'production') {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

app.whenReady().then(async () => {
  try {
    console.log('🚀 Starting Consultancy Desktop App...');
    
    // 1. Initialize database
    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    // 2. Run migrations
    console.log('🔄 Running migrations...');
    await runMigrations();
    console.log('✅ Migrations completed');

    // 3. Initialize file manager
    console.log('📁 Initializing file manager...');
    await fileManager.initialize();
    console.log('✅ File manager initialized');
    
    // 4. Register IPC handlers
    console.log('🔌 Registering IPC handlers...');
    registerIpcHandlers(app);
    console.log('✅ IPC handlers registered');
    
    // 5. Create window
    console.log('🪟 Creating main window...');
    createWindow();
    console.log('✅ Application ready!');

  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    console.error('Error stack:', error.stack);
    
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start application:\n\n${error.message}\n\nPlease check the console logs for more details.`
    );
    
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase().then(() => {
      app.quit();
    });
  }
});

app.on('before-quit', async () => {
  await closeDatabase();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
