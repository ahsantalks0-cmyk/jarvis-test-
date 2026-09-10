const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safe IPC Bridge for Jarvis Desktop Assistant.
 * Exposes a protected API namespace to the renderer process
 * while keeping Node.js integration disabled and context isolated.
 */
contextBridge.exposeInMainWorld('jarvisAPI', {
  // Application metadata & updater controls
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },

  // PC Control Test Handlers
  openBrowser: () => ipcRenderer.invoke('open-browser'),
  createDesktopFolder: () => ipcRenderer.invoke('create-desktop-folder'),
  createFolder: () => ipcRenderer.invoke('create-desktop-folder'),
  openNotepad: () => ipcRenderer.invoke('open-notepad'),
  openDownloads: () => ipcRenderer.invoke('open-downloads'),
  getSystemInfo: () => ipcRenderer.invoke('system-info'),
  systemInfo: () => ipcRenderer.invoke('system-info'),

  // More PC Tests Handlers
  openCalculator: () => ipcRenderer.invoke('open-calculator'),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text)
});
