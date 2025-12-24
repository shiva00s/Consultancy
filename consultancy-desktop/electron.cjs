// FILE: electron.cjs (UPDATED - Smart Tunnel Detection)

const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('path');
let ngrok = null;
try {
  ngrok = require('ngrok');
} catch (err) {
  console.warn('⚠️ Optional dependency "ngrok" not installed.');
}
const { exec } = require('child_process');
const util = require('util');
const { initializeCommunicationHandlers } = require('./src-electron/ipc/communicationHandlers.cjs');
const { initializeDatabase, closeDatabase, dbAll, dbRun } = require('./src-electron/db/database.cjs');
const { registerIpcHandlers, startReminderScheduler } = require('./src-electron/ipc/handlers.cjs');
const { fileManager } = require('./src-electron/utils/fileManager.cjs');
const TwilioWhatsAppService = require('./src-electron/services/twilioWhatsAppService.cjs');
const { initializeWhatsAppHandlers } = require('./src-electron/ipc/whatsappHandlers.cjs');

const {
  PermissionEngine,
  ROLES,
  FEATURES,
} = require('./src-electron/ipc/security/permissionEngine.cjs');

const execPromise = util.promisify(exec);

// ✅ CHECK FOR EXISTING NGROK TUNNEL
async function getExistingNgrokTunnel() {
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    const data = await response.json();
    
    if (data.tunnels && data.tunnels.length > 0) {
      // Find the first HTTP/HTTPS tunnel
      const httpTunnel = data.tunnels.find(t => 
        t.proto === 'https' && t.config && t.config.addr
      );
      
      if (httpTunnel) {
        console.log('✅ Found existing ngrok tunnel:', httpTunnel.public_url);
        return httpTunnel.public_url;
      }
    }
    return null;
  } catch (error) {
    // Ngrok API not available
    return null;
  }
}

// ✅ START OR REUSE NGROK TUNNEL
async function ensureNgrokTunnel(port, authToken) {
  try {
    // First, check if ngrok is already running with a tunnel
    const existingUrl = await getExistingNgrokTunnel();
    if (existingUrl) {
      console.log('♻️ Reusing existing ngrok tunnel:', existingUrl);
      return { url: existingUrl, isNew: false };
    }

    // No existing tunnel, start a new one
    console.log(`🌐 Starting fresh ngrok tunnel for port ${port}...`);
    
    if (authToken) {
      await ngrok.authtoken(authToken);
      console.log('✅ Ngrok auth token configured');
    }

    const url = await ngrok.connect({
      addr: port,
      authtoken: authToken || undefined,
      onStatusChange: status => {
        console.log(`📡 Ngrok status: ${status}`);
      }
    });

    console.log('✅ New ngrok tunnel created:', url);
    return { url, isNew: true };

  } catch (error) {
    console.error('❌ Failed to ensure ngrok tunnel:', error.message);
    throw error;
  }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('⚠️ Another instance is already running. Exiting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

if (process.env.NODE_ENV !== 'production') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

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
let whatsappService = null;
let ngrokUrl = null;
let db = null;

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
      'ERR_CONNECTION_REFUSED',
      'WebSocket connection',
    ];

    if (suppressPatterns.some((pattern) => message.includes(pattern))) {
      return;
    }

    switch (level) {
      case 'error':
        console.error(`[Renderer Error] ${message}`);
        if (lineNumber && sourceId) {
          console.error(` at ${sourceId}:${lineNumber}`);
        }
        break;
      case 'warning':
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[Renderer Warning] ${message}`);
        }
        break;
      default:
        if (process.env.NODE_ENV !== 'production' && level === 'info') {
          console.info(`[Renderer Info] ${message}`);
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
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.ngrok-free.dev/*', 'https://*.ngrok.io/*', 'https://*.ngrok-free.app/*'] },
    (details, callback) => {
      details.requestHeaders['ngrok-skip-browser-warning'] = 'true';
      details.requestHeaders['User-Agent'] = 'ConsultancyApp/1.0';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*.ngrok-free.dev/*', 'https://*.ngrok.io/*', 'https://*.ngrok-free.app/*'] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
          'Access-Control-Allow-Headers': ['*'],
        }
      });
    }
  );

  try {
    console.log('🚀 Starting Consultancy Desktop App...');

    db = await initializeDatabase();
    console.log('✅ Database initialized');

    await fileManager.initialize();
    console.log('✅ File manager initialized');

    registerIpcHandlers(app, {
      permissionContext,
      ROLES,
      FEATURES,
      PermissionEngine,
    });
    console.log('✅ IPC handlers registered');

    mainWindow = createWindow();
    console.log('✅ Main window created');

    console.log('📱 Initializing WhatsApp service...');
    
    try {
      console.log('🔑 Loading Twilio credentials from database...');
      
      const twilioSettings = await dbAll(
        db,
        `SELECT key, value FROM system_settings 
         WHERE key IN ('twilioaccountsid', 'twilioauthtoken', 'twiliowhatsappnumber', 'twilioNgrokUrl', 'ngrokAuthToken')`
      );

      const settings = {};
      if (Array.isArray(twilioSettings)) {
        twilioSettings.forEach(row => {
          settings[row.key] = row.value;
        });
      }

      const accountSid = settings.twilioaccountsid;
      const authToken = settings.twilioauthtoken;
      const whatsappNumber = settings.twiliowhatsappnumber;
      const ngrokAuthToken = settings.ngrokAuthToken;

      whatsappService = new TwilioWhatsAppService(mainWindow, db);
      
      initializeWhatsAppHandlers(db, whatsappService);
      initializeCommunicationHandlers();

      if (accountSid && authToken) {
        await whatsappService.initialize(accountSid, authToken, whatsappNumber);
        console.log('✅ WhatsApp service initialized with database credentials');
      } else {
        console.warn('⚠️ No Twilio credentials configured yet');
        await whatsappService.initialize();
      }

      // ✅ SMART NGROK TUNNEL MANAGEMENT
      if (ngrok && whatsappService && whatsappService.webhookServer && whatsappService.webhookServer.server) {
        try {
          const webhookPort = whatsappService.webhookServer.port || 3001;

          const tunnelResult = await ensureNgrokTunnel(webhookPort, ngrokAuthToken);
          ngrokUrl = tunnelResult.url;
          
          if (tunnelResult.isNew) {
            console.log('🎉 Created new ngrok tunnel');
          } else {
            console.log('♻️ Using existing ngrok tunnel');
          }
          
          // ✅ Save to database
          await dbRun(
            db,
            `INSERT OR REPLACE INTO system_settings (key, value) VALUES ('twilioNgrokUrl', ?)`,
            [ngrokUrl]
          );
          
          // ✅ Update webhook server
          if (whatsappService.webhookServer) {
            whatsappService.webhookServer.setNgrokUrl(ngrokUrl);
          }
          
          // ✅ Update Twilio webhook
          if (accountSid && authToken && whatsappNumber) {
            console.log('🔄 Updating Twilio webhook URLs...');
            const updateResult = await whatsappService.updateWebhookUrl(ngrokUrl);
            if (updateResult.success) {
              console.log('✅ Twilio webhook updated successfully');
              if (mainWindow) {
                mainWindow.webContents.send('ngrok-status', {
                  status: 'connected',
                  url: ngrokUrl,
                  isNew: tunnelResult.isNew
                });
              }
            } else {
              console.warn('⚠️ Failed to update Twilio webhook:', updateResult.error);
            }
          }
          
        } catch (ngrokError) {
          console.error('⚠️ Ngrok setup failed:', ngrokError.message);
          if (mainWindow) {
            mainWindow.webContents.send('ngrok-status', {
              status: 'error',
              error: ngrokError.message
            });
          }
        }
      } else {
        if (!ngrok) {
          console.warn('⚠️ Ngrok module not available');
        } else {
          console.warn('⚠️ Webhook server not available');
        }
      }

      // ✅ INITIALIZE SOCKET.IO
      if (whatsappService.webhookServer && whatsappService.webhookServer.server) {
        const RealtimeSync = require('./src-electron/services/realtimeSync.cjs');
        const httpServer = whatsappService.webhookServer.server;
        global.realtimeSync = new RealtimeSync(httpServer);
        console.log('✅ Real-time sync initialized');
      }

      console.log('✅ WhatsApp service ready');
    } catch (whatsappError) {
      console.error('⚠️ WhatsApp initialization failed:', whatsappError.message);
    }

    startReminderScheduler(mainWindow);
    console.log('✅ Application ready!');

  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start application:\n\n${error.message}`
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
      .then(() => app.quit())
      .catch((err) => {
        console.error('Error closing database:', err);
        app.quit();
      });
  }
});

app.on('before-quit', async (event) => {
  app.isQuitting = true;

  if (ngrok && ngrokUrl) {
    console.log('🔄 Disconnecting ngrok tunnel...');
    event.preventDefault();
    
    try {
      await ngrok.disconnect();
      console.log('✅ Ngrok tunnel disconnected');
    } catch (error) {
      console.error('Error disconnecting ngrok:', error);
    }
  }

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
    console.log('✅ Database closed');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
  
  if (event.defaultPrevented) {
    setImmediate(() => app.quit());
  }
});

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

process.on('uncaughtException', (error) => {
  const message = String(error && error.message);
  if (IGNORED_STARTUP_TABLE_ERRORS.some((p) => message.includes(p))) {
    return;
  }

  console.error('❌ Uncaught Exception:', message);
  if (process.env.NODE_ENV === 'production' && mainWindow) {
    dialog.showErrorBox('Application Error', `An unexpected error occurred.\n\nDetails: ${message}`);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  const message = String(reason && reason.message ? reason.message : reason);
  if (IGNORED_STARTUP_TABLE_ERRORS.some((p) => message.includes(p))) {
    return;
  }

  console.error('❌ Unhandled Rejection:', message);
  if (process.env.NODE_ENV === 'production' && mainWindow) {
    dialog.showErrorBox('Application Error', `An unexpected error occurred.\n\nDetails: ${message}`);
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
