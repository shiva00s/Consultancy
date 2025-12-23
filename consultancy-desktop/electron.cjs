// FILE: electron.cjs

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { initializeCommunicationHandlers } = require('./src-electron/ipc/communicationHandlers.cjs');
const { initializeDatabase, closeDatabase } = require('./src-electron/db/database.cjs');
const { registerIpcHandlers, startReminderScheduler } = require('./src-electron/ipc/handlers.cjs');
const { fileManager } = require('./src-electron/utils/fileManager.cjs');

// ✅ ADD WHATSAPP IMPORTS
const TwilioWhatsAppService = require('./src-electron/services/twilioWhatsAppService.cjs');
const { initializeWhatsAppHandlers } = require('./src-electron/ipc/whatsappHandlers.cjs');

// 🔐 Permission Engine
const {
  PermissionEngine,
  ROLES,
  FEATURES,
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
  },
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
    show: false,
    backgroundColor: '#1a1d2e',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('console-message', (event) => {
    const { level, message, lineNumber, sourceId } = event;

    const suppressPatterns = [
      'Autofill.enable failed',
      'Autofill.setAddresses failed',
      'protocol_client.js',
      'Download the React DevTools',
    ];

    if (suppressPatterns.some((pattern) => message.includes(pattern))) {
      return;
    }

    switch (level) {
      case 'error':
        console.error(`[Renderer Error] ${message}`);
        if (lineNumber && sourceId) {
          console.error(`  at ${sourceId}:${lineNumber}`);
        }
        break;
      case 'warning':
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

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents
      .executeJavaScript(`
        if (window.chrome && window.chrome.autofill) {
          delete window.chrome.autofill;
        }
        
        if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object') {
          for (let [key, value] of Object.entries(window.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
            if (typeof value === 'function') {
              window.__REACT_DEVTOOLS_GLOBAL_HOOK__[key] = () => {};
            }
          }
        }
      `)
      .catch(() => {});
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'file://'];

    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));

    if (!isAllowed) {
      event.preventDefault();
      console.warn('⚠️ Navigation blocked:', url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

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

    if (process.env.NODE_ENV !== 'production') {
      console.log('📦 Initializing database...');
    }
    const db = await initializeDatabase(); // ✅ STORE DB REFERENCE
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Database initialized');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('📁 Initializing file manager...');
    }
    await fileManager.initialize();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ File manager initialized');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔌 Registering IPC handlers...');
    }
    registerIpcHandlers(app, {
      permissionContext,
      ROLES,
      FEATURES,
      PermissionEngine,
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ IPC handlers registered');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('🪟 Creating main window...');
    }
    mainWindow = createWindow();

    // ✅ ADD WHATSAPP + REAL-TIME SYNC INITIALIZATION
if (process.env.NODE_ENV !== 'production') {
  console.log('📱 Initializing WhatsApp service...');
}

try {
  whatsappService = new TwilioWhatsAppService(mainWindow, db);
  initializeWhatsAppHandlers(db, whatsappService);
  initializeCommunicationHandlers();

  // ✅ FIXED: Initialize WhatsApp first
  await whatsappService.initialize();

  // ✅ NEW: Attach Socket.IO to the webhook HTTP server
  if (whatsappService.webhookServer && whatsappService.webhookServer.server) {
    const RealtimeSync = require('./src-electron/services/realtimeSync.cjs');
    
    // Get the HTTP server from Express
    const httpServer = whatsappService.webhookServer.server;
    
    global.realtimeSync = new RealtimeSync(httpServer);
    console.log('✅ Real-time sync initialized with webhook server');
  } else {
    console.error('❌ Webhook server not available for Socket.IO');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ WhatsApp service initialized');
  }
} catch (whatsappError) {
  console.error('⚠️ WhatsApp initialization failed:', whatsappError.message);
  console.error('Stack:', whatsappError.stack);
}


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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase()
      .then(() => {
        app.quit();
      })
      .catch((err) => {
        console.error('Error closing database:', err);
        app.quit();
      });
  }
});

// ✅ UPDATE before-quit TO CLEANUP WHATSAPP
app.on('before-quit', async (event) => {
  app.isQuitting = true;

  // ✅ ADD WHATSAPP CLEANUP
  if (whatsappService) {
    console.log('🔄 Cleaning up WhatsApp service...');
    try {
      await whatsappService.destroy();
      console.log('✅ WhatsApp service cleaned up');
    } catch (error) {
      console.error('Error cleaning up WhatsApp:', error);
    }
  }

  try {
    await closeDatabase();
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
});

// Shared list for ignorable startup DB errors
const IGNORED_STARTUP_TABLE_ERRORS = [
  'no such table: main.license_activation',
  'no such table: main.activation_requests',
  'no such table: main.passport_tracking',
  'no such table: main.passport_movement_photos',
  'no such table: main.passport_movements',
  'no such table: main.audit_log',
  'no such table: main.communication_logs',
  'no such table: main.user_features',
];

// Global error handlers
process.on('uncaughtException', (error) => {
  const message = String(error && error.message);

  if (IGNORED_STARTUP_TABLE_ERRORS.some((p) => message.includes(p))) {
    return;
  }

  console.error('❌ Uncaught Exception:', message);

  if (process.env.NODE_ENV === 'production' && mainWindow) {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred.\n\nDetails: ${message}`
    );
  }
});

process.on('unhandledRejection', (reason, promise) => {
  const message = String(reason && reason.message ? reason.message : reason);

  if (IGNORED_STARTUP_TABLE_ERRORS.some((p) => message.includes(p))) {
    return;
  }

  console.error('❌ Unhandled Rejection:', message);

  if (process.env.NODE_ENV === 'production' && mainWindow) {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred.\n\nDetails: ${message}`
    );
  }
});

process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, closing app gracefully...');
  app.quit();
});

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT received, closing app gracefully...');
  app.quit();
});
