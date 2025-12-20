const { dialog, app } = require('electron');
const path = require('path');

async function safeShowSaveDialog(win, options = {}) {
  if (options && options.bypassNative) {
    const defaultName = options.defaultPath || options.defaultName || `export-${Date.now()}`;
    const fallbackPath = path.join(app.getPath('downloads'), defaultName);
    return { canceled: false, filePath: fallbackPath };
  }
  return await dialog.showSaveDialog(win, options);
}

async function safeShowOpenDialog(win, options = {}) {
  if (options && options.bypassNative) {
    return { canceled: false, filePaths: [] };
  }
  return await dialog.showOpenDialog(win, options);
}

module.exports = { safeShowSaveDialog, safeShowOpenDialog };
