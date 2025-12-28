// FILE: electron.cjs (PRODUCTION-READY - SINGLE EXE MODE)

const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
let ngrok = null;

// ✅ PRODUCTION: Load ngrok conditionally
try {
  ngrok = require('@ngrok/ngrok');
} catch (err) {
  try {
    ngrok = require('ngrok');
  } catch (err2) {
    console.warn('⚠️ Ngrok not available in this build');
  }
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

// ✅ PRODUCTION MODE DETECTION
const isDevelopment = !app.isPackaged;
const isProduction = app.isPackaged;

// ✅ RESOURCE PATHS FOR PRODUCTION
function getResourcePath(relativePath) {
  if (isProduction) {
    // In production, resources are in the app.asar or extraResources
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, relativePath);
}

// ✅ NGROK TUNNEL MANAGER (PRODUCTION-SAFE) - FIXED VERSION
class NgrokTunnelManager {
  constructor() {
    this.tunnel = null;
    this.url = null;
    this.isConnected = false;
  }

  /**
   * Check if ngrok API is accessible (already running)
   */
  async checkExistingTunnel() {
    try {
      const response = await fetch('http://127.0.0.1:4040/api/tunnels', {
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      const data = await response.json();
      
      if (data.tunnels && data.tunnels.length > 0) {
        const httpTunnel = data.tunnels.find(t => 
          t.proto === 'https' && t.config && t.config.addr
        );
        
        if (httpTunnel) {
          this.url = httpTunnel.public_url;
          this.isConnected = true;
          return httpTunnel.public_url;
        }
      }
      return null;
    } catch (error) {
      // Ngrok not running or API not accessible
      return null;
    }
  }

  /**
   * Start fresh ngrok tunnel (embedded in app)
   */
  async startTunnel(port, authToken) {
    if (!ngrok) {
      throw new Error('Ngrok module not available');
    }

    try {
      console.log(`🌐 Starting ngrok tunnel for port ${port}...`);

      // Configure authtoken if provided
      if (authToken) {
        try {
          if (typeof ngrok.authtoken === 'function') {
            await ngrok.authtoken(authToken);
          } else if (typeof ngrok.setAuthtoken === 'function') {
            await ngrok.setAuthtoken(authToken);
          }
          console.log('✅ Ngrok auth token configured');
        } catch (authError) {
          console.warn('⚠️ Could not set auth token:', authError.message);
        }
      }

      // Start tunnel
      const tunnel = await ngrok.connect({
        addr: port,
        authtoken: authToken || undefined,
        region: 'in',
        onStatusChange: (status) => {
          console.log(`📡 Ngrok status: ${status}`);
        },
        onLogEvent: (log) => {
          if (isDevelopment) {
            console.log(`[Ngrok] ${log}`);
          }
        }
      });

      // ✅ FIX: Extract URL string from tunnel object
      let url;
      
      // Handle different ngrok module versions
      if (typeof tunnel === 'string') {
        // Old ngrok module returns string directly
        url = tunnel;
      } else if (tunnel && typeof tunnel.url === 'function') {
        // New @ngrok/ngrok module returns object with url() method
        url = await tunnel.url();
      } else if (tunnel && tunnel.url && typeof tunnel.url === 'string') {
        // Some versions have url as property
        url = tunnel.url;
      } else if (tunnel && tunnel.public_url) {
        // Fallback to public_url property
        url = tunnel.public_url;
      } else {
        // Last resort: check ngrok API
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec
        const apiUrl = await this.checkExistingTunnel();
        if (apiUrl) {
          url = apiUrl;
        } else {
          throw new Error('Could not extract URL from ngrok tunnel');
        }
      }

      if (!url || url === '[object Object]') {
        throw new Error('Invalid ngrok URL received');
      }

      this.tunnel = tunnel;
      this.url = url;
      this.isConnected = true;

      console.log('✅ Ngrok tunnel created:', url);
      return url;

    } catch (error) {
      console.error('❌ Failed to start ngrok tunnel:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Ensure tunnel exists (reuse or create new)
   */
  async ensureTunnel(port, authToken) {
    try {
      // Step 1: Check for existing tunnel
      const existingUrl = await this.checkExistingTunnel();
      if (existingUrl) {
        console.log('♻️ Reusing existing ngrok tunnel:', existingUrl);
        return { url: existingUrl, isNew: false };
      }

      // Step 2: No existing tunnel, create new one
      const newUrl = await this.startTunnel(port, authToken);
      return { url: newUrl, isNew: true };

    } catch (error) {
      console.error('❌ Tunnel creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect tunnel on shutdown
   */
  async disconnect() {
    if (!this.isConnected || !ngrok) {
      return;
    }

    try {
      console.log('🔄 Disconnecting ngrok tunnel...');
      
      if (typeof ngrok.disconnect === 'function') {
        await ngrok.disconnect();
      } else if (typeof ngrok.kill === 'function') {
        await ngrok.kill();
      }
      
      this.isConnected = false;
      this.url = null;
      console.log('✅ Ngrok tunnel disconnected');
    } catch (error) {
      console.error('⚠️ Error disconnecting ngrok:', error.message);
    }
  }

  /**
   * Get current tunnel URL
   */
  getUrl() {
    return this.url;
  }

  /**
   * Check connection status
   */
  isActive() {
    return this.isConnected;
  }
}


// ✅ SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('⚠️ Another instance is already running. Exiting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ✅ DISABLE SECURITY WARNINGS IN DEVELOPMENT
if (isDevelopment) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// ✅ AUTO-UPDATER (PRODUCTION ONLY)
let AutoUpdater = null;
let hasAutoUpdater = false;
try {
  const updaterModule = require('./src-electron/utils/autoUpdater.cjs');
  AutoUpdater = updaterModule.AutoUpdater;
  hasAutoUpdater = updaterModule.hasElectronUpdater;
} catch (error) {
  console.log('⚠️ Auto-updater module not loaded');
}

// ✅ GLOBAL STATE
let mainWindow = null;
let updater = null;
let whatsappService = null;
let ngrokManager = new NgrokTunnelManager();
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

// ✅ NEW: SAFE WINDOW COMMUNICATION HELPER
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data);
    } catch (err) {
      console.error(`Error sending to renderer [${channel}]:`, err.message);
    }
  }
}

// ✅ CREATE MAIN WINDOW
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366, // Optimized for your target resolution
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: isProduction,
      devTools: isDevelopment,
    },
    show: false,
    backgroundColor: '#1a1d2e',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ✅ SUPPRESS UNNECESSARY CONSOLE NOISE
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
        if (isDevelopment) {
          console.warn(`[Renderer Warning] ${message}`);
        }
        break;
      default:
        if (isDevelopment && level === 'info') {
          console.info(`[Renderer Info] ${message}`);
        }
    }
  });

  // ✅ INJECT CONSOLE CLEANUP
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

  // ✅ NAVIGATION SECURITY
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'file://',
      ...(isDevelopment ? ['http://localhost'] : [])
    ];
    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
      console.warn('⚠️ Navigation blocked:', url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // ✅ AUTO-UPDATER (PRODUCTION ONLY)
  if (isProduction && hasAutoUpdater && AutoUpdater) {
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

  // ✅ LOAD APP CONTENT
  if (isProduction) {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('❌ Production build not found at:', indexPath);
      dialog.showErrorBox(
        'Build Error',
        'Production files not found. Please run "npm run build" first.'
      );
      app.quit();
    }
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  // ✅ WINDOW CLOSE BEHAVIOR
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // ✅ NEW: Handle window destruction
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ✅ APP READY - INITIALIZATION SEQUENCE
app.whenReady().then(async () => {
  // ✅ NGROK HEADER INJECTION FOR BYPASS
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
    console.log(`📦 Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

    // ✅ STEP 1: Initialize Database
    db = await initializeDatabase();
    console.log('✅ Database initialized');

    // ✅ STEP 2: Initialize File Manager
    await fileManager.initialize();
    console.log('✅ File manager initialized');

    // ✅ STEP 3: Register IPC Handlers
    registerIpcHandlers(app, {
      permissionContext,
      ROLES,
      FEATURES,
      PermissionEngine,
    });
    console.log('✅ IPC handlers registered');

    // ✅ STEP 4: Create Main Window
    mainWindow = createWindow();
    console.log('✅ Main window created');

    // ✅ STEP 5: Initialize WhatsApp Service
    console.log('📱 Initializing WhatsApp service...');
    
    try {
      // Load Twilio credentials from database
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

      // Initialize WhatsApp service
      whatsappService = new TwilioWhatsAppService(mainWindow, db);
      initializeWhatsAppHandlers(db, whatsappService);
      initializeCommunicationHandlers();

      if (accountSid && authToken) {
        await whatsappService.initialize(accountSid, authToken, whatsappNumber);
        console.log('✅ WhatsApp service initialized');
      } else {
        console.warn('⚠️ No Twilio credentials configured yet');
        await whatsappService.initialize();
      }

      // ✅ STEP 6: Setup Ngrok Tunnel (PRODUCTION-SAFE)
      if (ngrok && whatsappService && whatsappService.webhookServer && whatsappService.webhookServer.server) {
        try {
          const webhookPort = whatsappService.webhookServer.port || 3001;

          const tunnelResult = await ngrokManager.ensureTunnel(webhookPort, ngrokAuthToken);
          const ngrokUrl = tunnelResult.url;
          
          console.log(tunnelResult.isNew ? '🎉 New ngrok tunnel created' : '♻️ Existing tunnel reused');
          
          // Save to database
          await dbRun(
            db,
            `INSERT OR REPLACE INTO system_settings (key, value) VALUES ('twilioNgrokUrl', ?)`,
            [ngrokUrl]
          );
          
          // Update webhook server
          if (whatsappService.webhookServer) {
            whatsappService.webhookServer.setNgrokUrl(ngrokUrl);
          }
          
          // Update Twilio webhook
          if (accountSid && authToken && whatsappNumber) {
            console.log('🔄 Updating Twilio webhook URLs...');
            const updateResult = await whatsappService.updateWebhookUrl(ngrokUrl);
            if (updateResult.success) {
              console.log('✅ Twilio webhook updated successfully');
              sendToRenderer('ngrok-status', {
                status: 'connected',
                url: ngrokUrl,
                isNew: tunnelResult.isNew
              });
            } else {
              console.warn('⚠️ Failed to update Twilio webhook:', updateResult.error);
            }
          }
          
        } catch (ngrokError) {
          console.error('⚠️ Ngrok setup failed:', ngrokError.message);
          sendToRenderer('ngrok-status', {
            status: 'error',
            error: ngrokError.message
          });
        }
      } else {
        console.warn('⚠️ Ngrok or webhook server not available');
      }

      // ✅ STEP 7: Initialize Socket.IO Real-time Sync
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

    // ✅ STEP 8: Start Reminder Scheduler
    startReminderScheduler(mainWindow);
    
    console.log('✅ Application ready!');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start application:\n\n${error.message}`
    );
    app.quit();
  }
});

// ✅ APP LIFECYCLE EVENTS
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup().then(() => app.quit());
  }
});

app.on('before-quit', async (event) => {
  app.isQuitting = true;
  event.preventDefault();
  await cleanup();
  setImmediate(() => app.quit());
});

// ✅ CLEANUP FUNCTION
async function cleanup() {
  console.log('🧹 Cleaning up application resources...');

  // ✅ NEW: Prevent multiple cleanups
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners();
  }

  // Disconnect ngrok tunnel
  if (ngrokManager && ngrokManager.isActive()) {
    try {
      await ngrokManager.disconnect();
    } catch (error) {
      console.error('Error disconnecting ngrok:', error);
    }
  }

  // Cleanup WhatsApp service
  if (whatsappService) {
    try {
      await whatsappService.destroy();
      console.log('✅ WhatsApp service cleaned up');
    } catch (error) {
      console.error('Error cleaning up WhatsApp:', error);
    }
  }

  // Close database
  try {
    await closeDatabase();
    console.log('✅ Database closed');
  } catch (err) {
    console.error('Error closing database:', err);
  }

  console.log('✅ Cleanup complete');
}

// ✅ ERROR HANDLERS
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
  if (isProduction && mainWindow && !mainWindow.isDestroyed()) {
    dialog.showErrorBox('Application Error', `An unexpected error occurred.\n\nDetails: ${message}`);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  const message = String(reason && reason.message ? reason.message : reason);
  if (IGNORED_STARTUP_TABLE_ERRORS.some((p) => message.includes(p))) {
    return;
  }

  console.error('❌ Unhandled Rejection:', message);
  if (isProduction && mainWindow && !mainWindow.isDestroyed()) {
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
