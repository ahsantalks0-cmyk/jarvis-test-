const { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
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

// PC Control IPC Handlers
ipcMain.handle('open-browser', async () => {
  try {
    await shell.openExternal('https://www.google.com');
    return {
      success: true,
      message: 'Opened default browser to https://www.google.com'
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to open browser: ${err.message || String(err)}`
    };
  }
});

ipcMain.handle('create-desktop-folder', async () => {
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const folderPath = path.join(desktopPath, 'JarvisTest');
    if (fs.existsSync(folderPath)) {
      return {
        success: true,
        message: `Folder already exists on Desktop: ${folderPath}`
      };
    }
    fs.mkdirSync(folderPath, { recursive: true });
    return {
      success: true,
      message: `Successfully created folder at: ${folderPath}`
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to create folder: ${err.message || String(err)}`
    };
  }
});

ipcMain.handle('open-notepad', async () => {
  try {
    const cmd = process.platform === 'win32'
      ? 'notepad.exe'
      : (process.platform === 'darwin' ? 'open -a TextEdit' : 'xdg-open');
    exec(cmd, (err) => {
      if (err) {
        console.warn('[PC-Control] Notepad process finished with note:', err.message);
      }
    });
    return {
      success: true,
      message: `Launched Notepad successfully (exec: ${cmd})`
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to launch Notepad: ${err.message || String(err)}`
    };
  }
});

ipcMain.handle('open-downloads', async () => {
  try {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const result = await shell.openPath(downloadsPath);
    if (result) {
      return {
        success: false,
        message: `Failed to open Downloads folder: ${result}`
      };
    }
    return {
      success: true,
      message: `Opened Downloads folder in File Explorer: ${downloadsPath}`
    };
  } catch (err) {
    return {
      success: false,
      message: `Error opening Downloads folder: ${err.message || String(err)}`
    };
  }
});

ipcMain.handle('system-info', async () => {
  try {
    const cpus = os.cpus();
    const cpuModel = cpus && cpus.length > 0 ? cpus[0].model.trim() : 'Unknown';
    const totalRamGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
    const freeRamGB = (os.freemem() / (1024 ** 3)).toFixed(2);
    const hostname = os.hostname();
    let username = 'Unknown';
    try {
      username = os.userInfo().username;
    } catch {
      username = process.env.USERNAME || process.env.USER || 'Unknown';
    }
    const platform = `${os.platform()} (${os.release()})`;

    return {
      success: true,
      message: `Platform: ${platform} | CPU: ${cpuModel} | RAM: ${freeRamGB} GB free / ${totalRamGB} GB total | Host: ${hostname} | User: ${username}`,
      data: {
        platform,
        cpuModel,
        totalRamGB,
        freeRamGB,
        hostname,
        username
      }
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to retrieve system info: ${err.message || String(err)}`
    };
  }
});

ipcMain.handle('open-calculator', async () => {
  try {
    const cmd = process.platform === 'win32'
      ? 'calc.exe'
      : (process.platform === 'darwin' ? 'open -a Calculator' : 'gnome-calculator || kcalc || xcalc');
    exec(cmd, (err) => {
      if (err) {
        console.warn('[PC-Control] Calculator process note:', err.message);
      }
    });
    return {
      success: true,
      message: `Launched Calculator successfully (exec: ${cmd})`
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to launch Calculator: ${err.message || String(err)}`
    };
  }
});

ipcMain.handle('read-clipboard', async () => {
  try {
    const text = clipboard.readText();
    return {
      success: true,
      message: text ? `Clipboard text: "${text}"` : 'Clipboard is empty (no text content)',
      data: text
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to read clipboard: ${err.message || String(err)}`
    };
  }
});

ipcMain.handle('write-clipboard', async (_event, text) => {
  try {
    const content = typeof text === 'string' ? text : String(text ?? '');
    clipboard.writeText(content);
    return {
      success: true,
      message: `Copied to clipboard: "${content}"`
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to write to clipboard: ${err.message || String(err)}`
    };
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
