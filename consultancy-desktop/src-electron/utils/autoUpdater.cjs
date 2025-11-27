let autoUpdater = null;
let hasElectronUpdater = false;

// Try to load electron-updater, but don't fail if not installed
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
  hasElectronUpdater = true;
} catch (err) {
  console.log('⚠️ electron-updater not installed. Auto-update feature disabled.');
  hasElectronUpdater = false;
}

const { dialog } = require('electron');

class AutoUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    
    if (hasElectronUpdater) {
      this.setupUpdater();
    } else {
      console.log('Auto-updater skipped - electron-updater package not found');
    }
  }

  setupUpdater() {
    if (!hasElectronUpdater || !autoUpdater) {
      return;
    }

    try {
      // Configure update settings
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;

      // Update events
      autoUpdater.on('checking-for-update', () => {
        console.log('Checking for updates...');
        this.sendStatusToWindow('Checking for updates...');
      });

      autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info);
        this.showUpdateAvailableDialog(info);
      });

      autoUpdater.on('update-not-available', (info) => {
        console.log('Update not available:', info);
      });

      autoUpdater.on('error', (err) => {
        console.error('Error in auto-updater:', err);
      });

      autoUpdater.on('download-progress', (progressObj) => {
        const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
        console.log(logMessage);
        this.sendStatusToWindow(logMessage);
        
        if (this.mainWindow) {
          this.mainWindow.webContents.send('download-progress', progressObj);
        }
      });

      autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info);
        this.showUpdateDownloadedDialog(info);
      });
    } catch (error) {
      console.error('Failed to setup auto-updater:', error);
    }
  }

  showUpdateAvailableDialog(info) {
    if (!this.mainWindow) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: `Release notes:\n${info.releaseNotes || 'No release notes available'}`,
      buttons: ['Download Update', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0 && autoUpdater) {
        autoUpdater.downloadUpdate();
        this.sendStatusToWindow('Downloading update...');
      }
    });
  }

  showUpdateDownloadedDialog(info) {
    if (!this.mainWindow) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: `Version ${info.version} has been downloaded. Restart to install.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0 && autoUpdater) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }

  sendStatusToWindow(text) {
    console.log(text);
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-status', text);
    }
  }

  checkForUpdates() {
    if (hasElectronUpdater && autoUpdater) {
      try {
        autoUpdater.checkForUpdates();
      } catch (error) {
        console.error('Check for updates failed:', error);
      }
    } else {
      console.log('Auto-updater not available');
    }
  }

  checkForUpdatesAndNotify() {
    if (hasElectronUpdater && autoUpdater) {
      try {
        autoUpdater.checkForUpdatesAndNotify();
      } catch (error) {
        console.error('Check for updates and notify failed:', error);
      }
    }
  }
}

module.exports = { AutoUpdater, hasElectronUpdater };
Buffer.from(fileBuffer),
        fileName,
        'resumes' 