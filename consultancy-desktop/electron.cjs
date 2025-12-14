const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

const { initializeDatabase, closeDatabase } = require('./src-electron/db/database.cjs');
const { runMigrations } = require('./src-electron/db/migrations.cjs');
const { registerIpcHandlers } = require('./src-electron/ipc/handlers.cjs');
const { fileManager } = require('./src-electron/utils/fileManager.cjs');

// 🔐 Permission Engine (NEW – injected)
const {
  PermissionEngine,
  ROLES,
  FEATURES
} = require('./src-electron/ipc/security/permissionEngine.cjs');

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

/**
 * Global permission context holder
 * Role will be injected later by auth flow (NOT assumed here)
 */
const permissionContext = {
  role: null,
  superAdminEnabled: [],
  adminGranted: [],
  getEngine() {
    return new PermissionEngine({
      role: this.role,
      superAdminEnabled: this.superAdminEnabled,
      adminGranted: this.adminGranted,
    });
  }
};

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

      setTimeout(() => {
        if (updater) {
          updater.checkForUpdatesAndNotify();
        }
      }, 5000);
    } catch (error) {
      console.error('❌ Failed to initialize auto-updater:', error);
    }
  }

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

    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized');

    console.log('🔄 Running migrations...');
    await runMigrations();
    console.log('✅ Migrations completed');

    console.log('📁 Initializing file manager...');
    await fileManager.initialize();
    console.log('✅ File manager initialized');

    console.log('🔌 Registering IPC handlers...');
    /**
     * 🔐 Inject permission context into IPC layer
     * No enforcement yet – only availability
     */
    registerIpcHandlers(app, {
      permissionContext,
      ROLES,
      FEATURES,
      PermissionEngine
    });
    console.log('✅ IPC handlers registered');

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

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
