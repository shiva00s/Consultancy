// FILE: electron.cjs (PRODUCTION-READY - FIXED DB CLEANUP)

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
const keyManager = require('./src-electron/services/keyManager.cjs');

// ✅ CRITICAL: Import migration function
let runMigration = null;
try {
  const migrationModule = require('./src-electron/db/migrations/add-performance-indexes.cjs');
  runMigration = migrationModule.runMigration || migrationModule;
} catch (migErr) {
  console.warn('⚠️ Performance migration module not found (non-critical)');
}

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

  async checkExistingTunnel() {
    try {
      const response = await fetch('http://127.0.0.1:4040/api/tunnels', {
        signal: AbortSignal.timeout(2000)
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
      return null;
    }
  }

  async startTunnel(port, authToken) {
    if (!ngrok) {
      throw new Error('Ngrok module not available');
    }

    try {
      console.log(`🌐 Starting ngrok tunnel for port ${port}...`);

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

      let url;
      
      if (typeof tunnel === 'string') {
        url = tunnel;
      } else if (tunnel && typeof tunnel.url === 'function') {
        url = await tunnel.url();
      } else if (tunnel && tunnel.url && typeof tunnel.url === 'string') {
        url = tunnel.url;
      } else if (tunnel && tunnel.public_url) {
        url = tunnel.public_url;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
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

  async ensureTunnel(port, authToken) {
    try {
      const existingUrl = await this.checkExistingTunnel();
      if (existingUrl) {
        console.log('♻️ Reusing existing ngrok tunnel:', existingUrl);
        return { url: existingUrl, isNew: false };
      }

      const newUrl = await this.startTunnel(port, authToken);
      return { url: newUrl, isNew: true };

    } catch (error) {
      console.error('❌ Tunnel creation failed:', error.message);
      throw error;
    }
  }

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

  getUrl() {
    return this.url;
  }

  isActive() {
    return this.isConnected;
  }
}

// ✅ SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('⚠️ Another instance is already running. Exiting...');
  app.quit();
  process.exit(0);
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
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: isProduction,
      devTools: true,
    },
    show: false,
    backgroundColor: '#1a1d2e',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isProduction) {
      mainWindow.webContents.openDevTools();
    }
  });

  try {
    keyManager.setMainWindow(mainWindow);
  } catch (err) {
    console.warn('Could not set mainWindow on keyManager:', err && err.message);
  }

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

  if (isProduction) {
    console.log('═'.repeat(60));
    console.log('🔍 PRODUCTION MODE - DEBUG INFO');
    console.log('═'.repeat(60));
    console.log('📂 __dirname:', __dirname);
    console.log('📂 process.resourcesPath:', process.resourcesPath);
    console.log('📂 app.getAppPath():', app.getAppPath());
    console.log('📂 process.cwd():', process.cwd());
    console.log('═'.repeat(60));

    const possiblePaths = [
      path.join(__dirname, 'dist', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    ];

    console.log('🔍 Checking possible index.html locations:');
    let foundPath = null;
    
    for (const testPath of possiblePaths) {
      const exists = fs.existsSync(testPath);
      console.log(`${exists ? '✅' : '❌'} ${testPath}`);
      if (exists && !foundPath) {
        foundPath = testPath;
      }
    }

    if (foundPath) {
      console.log('✅ Using path:', foundPath);
      mainWindow.loadFile(foundPath)
        .then(() => {
          console.log('✅ Successfully loaded index.html');
        })
        .catch(err => {
          console.error('❌ Failed to load index.html:', err);
          dialog.showErrorBox(
            'Loading Error',
            `Failed to load application:\n\n${err.message}\n\nPath: ${foundPath}`
          );
        });
    } else {
      console.error('❌ index.html not found in any location!');
      
      console.log('\n📁 Files in __dirname:');
      try {
        const files = fs.readdirSync(__dirname);
        files.forEach(file => console.log(`  - ${file}`));
        
        const distPath = path.join(__dirname, 'dist');
        if (fs.existsSync(distPath)) {
          console.log('\n📁 Files in dist folder:');
          const distFiles = fs.readdirSync(distPath);
          distFiles.forEach(file => console.log(`  - ${file}`));
        }
      } catch (err) {
        console.error('Could not read directories:', err);
      }
      
      dialog.showErrorBox(
        'Build Error',
        'Production files not found.\n\nCheck console for details.'
      );
    }
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ✅ APP READY - INITIALIZATION SEQUENCE
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
    console.log('═'.repeat(60));
    console.log('🚀 Starting Consultancy Desktop App...');
    console.log(`📦 Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log('═'.repeat(60));

    console.log('🗄️ Initializing database...');
    db = await initializeDatabase();
    console.log('✅ Database schema initialized');

    // ✅ FIXED: Conditional migration execution
    if (runMigration && typeof runMigration === 'function') {
      console.log('🔧 Applying performance optimizations...');
      try {
        const migrationResult = await runMigration();
        console.log(`✅ Performance indexes created: ${migrationResult?.indexesCreated || 'complete'}`);
      } catch (migrationError) {
        console.error('⚠️ Migration warning (non-critical):', migrationError.message);
      }
    } else {
      console.log('ℹ️ Performance migration skipped (module not found)');
    }

    // Run additional DB migrations
    try {
      const addSalaryMigration = require('./src-electron/db/migrations/add-salary-to-joborders.cjs');
      if (typeof addSalaryMigration === 'function') {
        await addSalaryMigration();
        console.log('✅ add-salary-to-joborders migration applied');
      }
    } catch (mErr) {
      console.warn('⚠️ add-salary-to-joborders migration skipped');
    }

    try {
      const compatViews = require('./src-electron/db/migrations/add-compat-views.cjs');
      if (typeof compatViews === 'function') {
        await compatViews();
        console.log('✅ add-compat-views migration applied');
      }
    } catch (cvErr) {
      console.warn('⚠️ add-compat-views migration skipped');
    }

    console.log('📁 Initializing file manager...');
    await fileManager.initialize();
    console.log('✅ File manager ready');

    console.log('🔌 Registering IPC handlers...');
    registerIpcHandlers(app, {
      permissionContext,
      ROLES,
      FEATURES,
      PermissionEngine,
    });
    console.log('✅ IPC handlers registered');

    console.log('🪟 Creating main window...');
    mainWindow = createWindow();
    console.log('✅ Main window created');

    console.log('📱 Initializing WhatsApp service...');
    
    try {
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
        console.log('✅ WhatsApp service initialized with credentials');
      } else {
        console.warn('⚠️ No Twilio credentials configured yet');
        await whatsappService.initialize();
      }

      if (ngrok && whatsappService && whatsappService.webhookServer && whatsappService.webhookServer.server) {
        try {
          const webhookPort = whatsappService.webhookServer.port || 3001;

          console.log(`🌐 Setting up ngrok tunnel on port ${webhookPort}...`);
          const tunnelResult = await ngrokManager.ensureTunnel(webhookPort, ngrokAuthToken);
          const ngrokUrl = tunnelResult.url;
          
          console.log(tunnelResult.isNew ? '🎉 New ngrok tunnel created' : '♻️ Existing tunnel reused');
          console.log(`📡 Public URL: ${ngrokUrl}`);
          
          await dbRun(
            db,
            `INSERT OR REPLACE INTO system_settings (key, value) VALUES ('twilioNgrokUrl', ?)`,
            [ngrokUrl]
          );
          
          if (whatsappService.webhookServer) {
            whatsappService.webhookServer.setNgrokUrl(ngrokUrl);
          }
          
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
          console.error('⚠️ Ngrok setup failed (non-critical):', ngrokError.message);
          sendToRenderer('ngrok-status', {
            status: 'error',
            error: ngrokError.message
          });
        }
      } else {
        console.warn('⚠️ Ngrok or webhook server not available');
      }

      if (whatsappService.webhookServer && whatsappService.webhookServer.server) {
        console.log('⚡ Initializing real-time sync...');
        const RealtimeSync = require('./src-electron/services/realtimeSync.cjs');
        const httpServer = whatsappService.webhookServer.server;
        global.realtimeSync = new RealtimeSync(httpServer);
        console.log('✅ Real-time sync initialized');
      }

      console.log('✅ WhatsApp service ready');
    } catch (whatsappError) {
      console.error('⚠️ WhatsApp initialization failed (non-critical):', whatsappError.message);
    }

    console.log('⏰ Starting reminder scheduler...');
    startReminderScheduler(mainWindow);
    console.log('✅ Reminder scheduler started');
    
    console.log('═'.repeat(60));
    console.log('✅ Application fully initialized and ready!');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('═'.repeat(60));
    console.error('❌ CRITICAL ERROR during initialization:');
    console.error('═'.repeat(60));
    console.error(error);
    console.error('═'.repeat(60));
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start application:\n\n${error.message}\n\nCheck console for details.`
    );
    app.quit();
  }
});

// ✅✅✅ CRITICAL FIX: PROPER DATABASE CLEANUP ✅✅✅

let isCleaningUp = false;

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (isCleaningUp) {
    return;
  }

  event.preventDefault();
  isCleaningUp = true;
  app.isQuitting = true;

  console.log('═'.repeat(60));
  console.log('🧹 SHUTTING DOWN APPLICATION');
  console.log('═'.repeat(60));

  performCleanup()
    .then(() => {
      console.log('✅ Cleanup successful - Goodbye!');
      console.log('═'.repeat(60));
      app.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup error:', error);
      app.exit(1);
    });
});

async function performCleanup() {
  // Step 1: CLOSE DATABASE FIRST
  try {
    console.log('[1/4] 🗄️  Closing database connection...');
    if (db) {
      await closeDatabase();
      db = null;
      console.log('[1/4] ✅ Database closed successfully');
    } else {
      console.log('[1/4] ℹ️  Database not initialized');
    }
  } catch (error) {
    console.error('[1/4] ❌ Database close error:', error);
    db = null;
  }

  // Step 2: Disconnect ngrok
  try {
    if (ngrokManager && ngrokManager.isActive()) {
      console.log('[2/4] 🌐 Disconnecting ngrok tunnel...');
      await Promise.race([
        ngrokManager.disconnect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      console.log('[2/4] ✅ Ngrok disconnected');
    } else {
      console.log('[2/4] ℹ️  Ngrok not active');
    }
  } catch (error) {
    console.error('[2/4] ⚠️  Ngrok disconnect warning:', error.message);
  }

  // Step 3: Cleanup WhatsApp service
  try {
    if (whatsappService && typeof whatsappService.destroy === 'function') {
      console.log('[3/4] 📱 Cleaning up WhatsApp service...');
      await Promise.race([
        whatsappService.destroy(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      whatsappService = null;
      console.log('[3/4] ✅ WhatsApp service cleaned up');
    } else {
      console.log('[3/4] ℹ️  WhatsApp service not initialized');
    }
  } catch (error) {
    console.error('[3/4] ⚠️  WhatsApp cleanup warning:', error.message);
  }

  // Step 4: Remove window listeners
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[4/4] 🪟 Cleaning up window...');
      mainWindow.removeAllListeners();
      mainWindow = null;
      console.log('[4/4] ✅ Window cleaned up');
    } else {
      console.log('[4/4] ℹ️  Window already destroyed');
    }
  } catch (error) {
    console.error('[4/4] ⚠️  Window cleanup warning:', error.message);
  }
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

process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received - Force closing database');
  try {
    if (db) await closeDatabase();
  } catch (e) {
    console.error('SIGTERM DB close error:', e);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received - Force closing database');
  try {
    if (db) await closeDatabase();
  } catch (e) {
    console.error('SIGINT DB close error:', e);
  }
  process.exit(0);
});

if (process.platform === 'win32') {
  process.on('message', async (msg) => {
    if (msg === 'graceful-exit') {
      console.log('⚠️  Graceful exit requested (Windows)');
      try {
        if (db) await closeDatabase();
      } catch (e) {
        console.error('Windows graceful exit DB close error:', e);
      }
      process.exit(0);
    }
  });
}
// ================= KEY MANAGER SERVICE =================