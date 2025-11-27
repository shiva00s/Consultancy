const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

class AutoUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupUpdater();
  }

  setupUpdater() {
    // Configure logging
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // Configure update server (GitHub Releases)
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Update events
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.sendStatusToWindow('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.sendStatusToWindow('You are running the latest version');
    });

    autoUpdater.on('error', (err) => {
      log.error('Error in auto-updater:', err);
      this.sendStatusToWindow(`Update error: ${err.toString()}`);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
      log.info(logMessage);
      this.sendStatusToWindow(logMessage);
      
      // Send progress to renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('download-progress', progressObj);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.showUpdateDownloadedDialog(info);
    });
  }

  showUpdateAvailableDialog(info) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: `Current version: ${require('../../../package.json').version}\nNew version: ${info.version}\n\nRelease notes:\n${info.releaseNotes || 'No release notes available'}`,
      buttons: ['Download Update', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
        this.sendStatusToWindow('Downloading update...');
      }
    });
  }

  showUpdateDownloadedDialog(info) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: `Version ${info.version} has been downloaded. The application will restart to install the update.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }

  sendStatusToWindow(text) {
    log.info(text);
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-status', text);
    }
  }

  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }

  checkForUpdatesAndNotify() {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

module.exports = { AutoUpdater };
