const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { initializeDatabase } = require('./src-electron/db/database.cjs');
const { runMigrations } = require('./src-electron/db/migrations.cjs');
const { registerIpcHandlers } = require('./src-electron/ipc/handlers.cjs');
const { startServer } = require('./src-electron/server/api.cjs');
const { fileManager } = require('./src-electron/utils/fileManager.cjs');

// Try to load auto-updater (optional)
let AutoUpdater = null;
let hasAutoUpdater = false;

try {
  const updaterModule = require('./src-electron/utils/autoUpdater.cjs');
  AutoUpdater = updaterModule.AutoUpdater;
  hasAutoUpdater = updaterModule.hasElectronUpdater;
} catch (error) {
  console.log('⚠️ Auto-updater module not loaded:', error.message);
}

let updater;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  // Initialize auto-updater if available
  if (hasAutoUpdater && AutoUpdater) {
    try {
      updater = new AutoUpdater(win);
      
      // Check for updates after 3 seconds
      setTimeout(() => {
        if (updater) {
          updater.checkForUpdatesAndNotify();
        }
      }, 3000);
    } catch (error) {
      console.error('Failed to initialize auto-updater:', error);
    }
  } else {
    console.log('Auto-updater disabled');
  }

  if (process.env.NODE_ENV === 'production') {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  }

  return win;
}

async function isActivated() {
  const db = getDatabase();
  return new Promise((resolve) => {
    db.get(
      "SELECT value FROM system_settings WHERE key = 'license_status'",
      [],
      (err, row) => {
        if (err || !row) return resolve(false);
        resolve(row.value === 'activated');
      }
    );
  });
}

app.whenReady().then(async () => {
  try {
    console.log('🚀 Starting Consultancy Desktop App...');
    
    // 1. Initialize database
    console.log('📦 Initializing database...');
    try {
      await initializeDatabase();
      console.log('✅ Database initialized');
    } catch (dbError) {
      console.error('❌ Database initialization failed:', dbError);
      console.error('Error details:', {
        message: dbError.message,
        stack: dbError.stack,
        code: dbError.code
      });
      throw dbError; // Re-throw to be caught by outer catch
    }
    
    console.log('🔄 Running migrations...');
    await runMigrations();
    console.log('✅ Migrations completed');

    // 2. Initialize file manager
    console.log('📁 Initializing file manager...');
    await fileManager.initialize();
    console.log('✅ File manager initialized');
    
    // 3. Register IPC handlers
    console.log('🔌 Registering IPC handlers...');
    registerIpcHandlers(app);
    console.log('✅ IPC handlers registered');
    
    // 4. Start API server (if you have one)
    if (typeof startServer === 'function') {
      console.log('🌐 Starting API server...');
      try {
        startServer();
        console.log('✅ API server started');
      } catch (serverError) {
        console.warn('⚠️ API server failed to start:', serverError.message);
      }
    }
    
    // 5. Create window
    console.log('🪟 Creating main window...');
    createWindow();
    console.log('✅ Application ready!');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    
    // Show error dialog
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start application:\n\n${error.message}\n\nPlease check the logs and try again.`
    );
    
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
