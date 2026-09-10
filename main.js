const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let isManualCheck = false;

// Configure electron-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console;

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 450,
    backgroundColor: '#0b0f19',
    title: 'Jarvis v1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupUpdaterEvents() {
  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    sendToWindow('update-status', {
      status: 'checking',
      message: 'Checking for updates...'
    });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    sendToWindow('update-status', {
      status: 'available',
      version: info.version,
      message: `Update v${info.version} available. Downloading...`
    });

    if (isManualCheck) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available and downloading in the background.`,
        buttons: ['OK']
      });
      isManualCheck = false;
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] Update not available.');
    const currentVersion = app.getVersion();
    sendToWindow('update-status', {
      status: 'not-available',
      version: currentVersion,
      message: `Jarvis is up to date (v${currentVersion}).`
    });

    if (isManualCheck) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Check for Updates',
        message: `You are running the latest version of Jarvis (v${currentVersion}).`,
        buttons: ['OK']
      });
      isManualCheck = false;
    }
  });

  autoUpdater.on('error', (err) => {
    const errorMsg = err == null ? 'Unknown updater error' : (err.message || String(err));
    console.error('[Updater] Error:', errorMsg);
    sendToWindow('update-status', {
      status: 'error',
      message: `Update error: ${errorMsg}`
    });

    if (isManualCheck) {
      dialog.showErrorBox('Update Check Failed', errorMsg);
      isManualCheck = false;
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(`[Updater] Download progress: ${percent}%`);
    sendToWindow('update-status', {
      status: 'downloading',
      percent,
      message: `Downloading update: ${percent}%`
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    sendToWindow('update-status', {
      status: 'downloaded',
      version: info.version,
      message: `Update v${info.version} downloaded. It will be installed when you quit.`
    });

    if (isManualCheck) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded. It will be installed automatically when you quit the app.`,
        buttons: ['OK']
      });
      isManualCheck = false;
    }
  });
}

function createMenu(win) {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Check for Updates',
          click: async () => {
            isManualCheck = true;
            try {
              await autoUpdater.checkForUpdates();
            } catch (err) {
              const msg = err == null ? 'Unknown error' : (err.message || String(err));
              dialog.showErrorBox('Update Check Failed', msg);
              isManualCheck = false;
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About Jarvis',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About Jarvis',
              message: `Jarvis Desktop Assistant\nVersion: ${app.getVersion()}`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  isManualCheck = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result: result ? { version: result.updateInfo?.version } : null };
  } catch (err) {
    const msg = err == null ? 'Unknown error' : (err.message || String(err));
    return { success: false, error: msg };
  }
});

// App Lifecycle
app.whenReady().then(() => {
  setupUpdaterEvents();
  createWindow();
  createMenu(mainWindow);

  // Check for updates on startup from GitHub releases
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.log('[Updater] Initial startup check notice:', err.message);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
