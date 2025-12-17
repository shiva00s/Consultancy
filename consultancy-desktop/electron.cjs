const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

const { initializeDatabase, closeDatabase } = require('./src-electron/db/database.cjs');
const { runMigrations } = require('./src-electron/db/schema/migrations.cjs');
const { registerIpcHandlers,startReminderScheduler, } = require('./src-electron/ipc/handlers.cjs');
const { fileManager } = require('./src-electron/utils/fileManager.cjs');


// 🔐 Permission Engine
const {
  PermissionEngine,
  ROLES,
  FEATURES
} = require('./src-electron/ipc/security/permissionEngine.cjs');

// Suppress Electron security warnings in development
if (process.env.NODE_ENV !== 'production') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

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
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: process.env.NODE_ENV === 'production',
      devTools: process.env.NODE_ENV !== 'production',
    },
    show: false, // Don't show until ready
    backgroundColor: '#1a1d2e', // Match your app's dark theme
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ✅ FIXED: New console-message event signature (no deprecation warning)
  mainWindow.webContents.on('console-message', (event) => {
    const { level, message, lineNumber, sourceId } = event;
    
    // Suppress known non-critical warnings
    const suppressPatterns = [
      'Autofill.enable failed',
      'Autofill.setAddresses failed',
      'protocol_client.js',
      'Download the React DevTools', // React DevTools suggestion
    ];
    
    if (suppressPatterns.some(pattern => message.includes(pattern))) {
      return; // Don't log these
    }
    
    // Map level strings to console methods
    switch (level) {
      case 'error':
        console.error(`[Renderer Error] ${message}`);
        if (lineNumber && sourceId) {
          console.error(`  at ${sourceId}:${lineNumber}`);
        }
        break;
      case 'warning':
        // Only log warnings in development
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[Renderer Warning] ${message}`);
        }
        break;
      case 'info':
        if (process.env.NODE_ENV !== 'production') {
          console.info(`[Renderer Info] ${message}`);
        }
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[Renderer Debug] ${message}`);
        }
        break;
      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Renderer] ${message}`);
        }
    }
  });

  // ✅ Disable autofill and cleanup after window loads
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      // Disable autofill
      if (window.chrome && window.chrome.autofill) {
        delete window.chrome.autofill;
      }
      
      // Suppress React DevTools message
      if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object') {
        for (let [key, value] of Object.entries(window.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
          if (typeof value === 'function') {
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__[key] = () => {};
          }
        }
      }
    `).catch(() => {
      // Silently ignore if it fails
    });
  });

  // Prevent navigation to external URLs (security)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'file://',
    ];
    
    const isAllowed = allowedOrigins.some(origin => url.startsWith(origin));
    
    if (!isAllowed) {
      event.preventDefault();
      console.warn('⚠️ Navigation blocked:', url);
    }
  });

  // Prevent opening new windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Initialize auto-updater if available
  if (hasAutoUpdater && AutoUpdater) {
    try {
      updater = new AutoUpdater(mainWindow);

      // Check for updates 5 seconds after launch
      setTimeout(() => {
        if (updater) {
          updater.checkForUpdatesAndNotify();
        }
      }, 5000);
    } catch (error) {
      console.error('❌ Failed to initialize auto-updater:', error);
    }
  }

  // Load the app
  if (process.env.NODE_ENV === 'production') {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

app.whenReady().then(async () => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🚀 Starting Consultancy Desktop App...');
    }

    // Initialize database
    if (process.env.NODE_ENV !== 'production') {
      console.log('📦 Initializing database...');
    }
    await initializeDatabase();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Database initialized');
    }

    // Run migrations
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 Running migrations...');
    }
    await runMigrations();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Migrations completed');
    }

    // Initialize file manager
    if (process.env.NODE_ENV !== 'production') {
      console.log('📁 Initializing file manager...');
    }
    await fileManager.initialize();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ File manager initialized');
    }

    // Register IPC handlers
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔌 Registering IPC handlers...');
    }
    registerIpcHandlers(app, {
      permissionContext,
      ROLES,
      FEATURES,
      PermissionEngine
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ IPC handlers registered');
    }

    // Create window
    if (process.env.NODE_ENV !== 'production') {
      console.log('🪟 Creating main window...');
    }
    mainWindow = createWindow();

    // 🔔 Start reminder scheduler (checks DB every 60s and sends reminder-due)
    startReminderScheduler(mainWindow);

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Application ready!');
    }

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

// macOS: Re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

// Close app when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase().then(() => {
      app.quit();
    }).catch((err) => {
      console.error('Error closing database:', err);
      app.quit();
    });
  }
});

// Cleanup before quit
app.on('before-quit', async (event) => {
  app.isQuitting = true;
  
  try {
    await closeDatabase();
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Show error dialog in production
  if (process.env.NODE_ENV === 'production' && mainWindow) {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred:\n\n${error.message}`
    );
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Show error dialog in production
  if (process.env.NODE_ENV === 'production' && mainWindow) {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred:\n\n${reason}`
    );
  }
});

// Graceful shutdown on SIGTERM
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, closing app gracefully...');
  app.quit();
});

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT received, closing app gracefully...');
  app.quit();
});
