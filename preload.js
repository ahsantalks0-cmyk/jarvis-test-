const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safe IPC Bridge for Jarvis Desktop Assistant.
 * Exposes a protected API namespace to the renderer process
 * while keeping Node.js integration disabled and context isolated.
 */
contextBridge.exposeInMainWorld('jarvisAPI', {
  // Empty secure API reserved for requesting future OS actions
  system: Object.freeze({}),

  // Application metadata & updater controls
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  }
});
