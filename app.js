/**
 * Jarvis Desktop Assistant UI Logic
 */
document.addEventListener('DOMContentLoaded', async () => {
  const versionDisplay = document.getElementById('app-version');
  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  const updateStatusText = document.getElementById('update-status-text');
  const updateStatusSub = document.getElementById('update-status-sub');
  const statusBadge = document.getElementById('status-badge');
  const progressBar = document.getElementById('download-progress-bar');
  const progressContainer = document.getElementById('progress-container');

  // PC Control Buttons
  const btnOpenBrowser = document.getElementById('btn-open-browser');
  const btnCreateFolder = document.getElementById('btn-create-folder');
  const btnOpenNotepad = document.getElementById('btn-open-notepad');
  const btnOpenDownloads = document.getElementById('btn-open-downloads');
  const btnSystemInfo = document.getElementById('btn-system-info');
  const btnClearLog = document.getElementById('btn-clear-log');
  const logOutput = document.getElementById('log-output');

  const isElectron = Boolean(window.jarvisAPI);

  // Initialize version
  let appVersion = '1.0.1';
  if (isElectron && window.jarvisAPI.getAppVersion) {
    try {
      appVersion = await window.jarvisAPI.getAppVersion();
    } catch (err) {
      console.warn('Could not fetch app version from main process:', err);
    }
  }
  if (versionDisplay) {
    versionDisplay.textContent = `v${appVersion}`;
  }

  // Helper to update status UI
  function setStatus(badgeText, badgeType, mainText, subText = '') {
    if (statusBadge) {
      statusBadge.textContent = badgeText;
      statusBadge.className = `status-badge ${badgeType}`;
    }
    if (updateStatusText) {
      updateStatusText.textContent = mainText;
    }
    if (updateStatusSub) {
      updateStatusSub.textContent = subText;
    }
  }

  // Subscribe to real-time update events from Electron main process
  if (isElectron && window.jarvisAPI.onUpdateStatus) {
    window.jarvisAPI.onUpdateStatus((data) => {
      if (!data) return;

      if (data.status === 'checking') {
        setStatus('Checking', 'badge-info', 'Checking GitHub releases for updates...', 'Connecting to repository...');
        if (progressContainer) progressContainer.style.display = 'none';
      } else if (data.status === 'available') {
        setStatus('Update Found', 'badge-accent', `Version ${data.version} found!`, 'Downloading update in background...');
        if (progressContainer) progressContainer.style.display = 'block';
      } else if (data.status === 'not-available') {
        setStatus('Up to Date', 'badge-success', `Jarvis is up to date (v${data.version || appVersion})`, 'Running latest build');
        if (checkUpdatesBtn) checkUpdatesBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      } else if (data.status === 'downloading') {
        setStatus('Downloading', 'badge-accent', `Downloading update (${data.percent}%)`, 'Please wait while update packages download');
        if (progressBar) {
          progressBar.style.width = `${data.percent}%`;
        }
        if (progressContainer) progressContainer.style.display = 'block';
      } else if (data.status === 'downloaded') {
        setStatus('Ready to Install', 'badge-success', `Update v${data.version} downloaded!`, 'Will install automatically when app quits');
        if (checkUpdatesBtn) checkUpdatesBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      } else if (data.status === 'error') {
        setStatus('Notice', 'badge-warning', 'Update check status', data.message || 'No published release found or offline');
        if (checkUpdatesBtn) checkUpdatesBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
      }
    });
  }

  // Auto-Update check button
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', async () => {
      checkUpdatesBtn.disabled = true;
      setStatus('Checking', 'badge-info', 'Checking for updates...', 'Requesting update check from main process...');

      if (isElectron && window.jarvisAPI.checkForUpdates) {
        try {
          const res = await window.jarvisAPI.checkForUpdates();
          if (res && !res.success) {
            setStatus('Notice', 'badge-warning', 'Update check completed', res.error || 'Check main console for release details');
          }
        } catch (err) {
          setStatus('Error', 'badge-error', 'Failed to trigger check', err.message || String(err));
        } finally {
          setTimeout(() => {
            if (checkUpdatesBtn) checkUpdatesBtn.disabled = false;
          }, 1500);
        }
      } else {
        setTimeout(() => {
          setStatus(
            'Simulated',
            'badge-info',
            'IPC call dispatched: check-for-updates',
            'In Electron desktop environment, this queries the GitHub repository releases and auto-downloads update files.'
          );
          if (checkUpdatesBtn) checkUpdatesBtn.disabled = false;
        }, 800);
      }
    });
  }

  // ----------------------------------------------------
  // Execution Log Helpers
  // ----------------------------------------------------
  function appendLog(status, message, details = null) {
    const emptyNotice = document.getElementById('log-empty');
    if (emptyNotice) {
      emptyNotice.remove();
    }

    if (!logOutput) return;

    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0]; // HH:MM:SS

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${timestamp}]`;

    const statusSpan = document.createElement('span');
    const isSuccess = status.toUpperCase() === 'SUCCESS';
    statusSpan.className = isSuccess ? 'log-status-success' : 'log-status-failed';
    statusSpan.textContent = `[${status.toUpperCase()}]`;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'log-msg';
    msgSpan.textContent = message;

    entry.appendChild(timeSpan);
    entry.appendChild(statusSpan);
    entry.appendChild(msgSpan);

    if (details) {
      const detailBox = document.createElement('div');
      detailBox.className = 'log-detail-box';
      detailBox.textContent = details;
      entry.appendChild(detailBox);
    }

    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  function formatSystemInfo(data) {
    if (!data) return '';
    return [
      `• Hostname:   ${data.hostname || 'N/A'}`,
      `• OS User:    ${data.username || 'N/A'}`,
      `• Platform:   ${data.platform || 'N/A'}`,
      `• CPU:        ${data.cpuModel || 'N/A'}`,
      `• Memory:     ${data.freeRamGB} GB free / ${data.totalRamGB} GB total`
    ].join('\n');
  }

  if (btnClearLog && logOutput) {
    btnClearLog.addEventListener('click', () => {
      logOutput.innerHTML = '<div class="log-empty" id="log-empty">No commands executed yet. Click any button above to test local PC control.</div>';
    });
  }

  async function handleControlAction(btn, apiMethod, actionName, mockFn) {
    if (btn) btn.disabled = true;
    try {
      if (isElectron && window.jarvisAPI && typeof window.jarvisAPI[apiMethod] === 'function') {
        const res = await window.jarvisAPI[apiMethod]();
        const isSuccess = Boolean(res && res.success);
        let detailText = null;

        if (res && res.data) {
          detailText = formatSystemInfo(res.data);
        }

        appendLog(
          isSuccess ? 'SUCCESS' : 'FAILED',
          (res && res.message) || `${actionName}: Command executed`,
          detailText
        );
      } else {
        // Fallback simulation in web browser preview
        await new Promise((resolve) => setTimeout(resolve, 350));
        const mock = mockFn();
        appendLog(
          mock.success ? 'SUCCESS' : 'FAILED',
          mock.message,
          mock.details || null
        );
      }
    } catch (err) {
      appendLog('FAILED', `${actionName} execution failed: ${err.message || String(err)}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // 1. Open Browser
  if (btnOpenBrowser) {
    btnOpenBrowser.addEventListener('click', () => {
      handleControlAction(btnOpenBrowser, 'openBrowser', 'Open Browser', () => ({
        success: true,
        message: 'Opened https://www.google.com in default browser (shell.openExternal simulated in web preview)'
      }));
    });
  }

  // 2. Create Desktop Folder
  if (btnCreateFolder) {
    btnCreateFolder.addEventListener('click', () => {
      handleControlAction(btnCreateFolder, 'createDesktopFolder', 'Create Desktop Folder', () => ({
        success: true,
        message: 'Created folder "JarvisTest" on Desktop at ~/Desktop/JarvisTest (simulated in web preview)'
      }));
    });
  }

  // 3. Open Notepad
  if (btnOpenNotepad) {
    btnOpenNotepad.addEventListener('click', () => {
      handleControlAction(btnOpenNotepad, 'openNotepad', 'Open Notepad', () => ({
        success: true,
        message: 'Launched Notepad using child_process.exec("notepad.exe") (simulated in web preview)'
      }));
    });
  }

  // 4. Open Downloads Folder
  if (btnOpenDownloads) {
    btnOpenDownloads.addEventListener('click', () => {
      handleControlAction(btnOpenDownloads, 'openDownloads', 'Open Downloads', () => ({
        success: true,
        message: 'Opened Downloads folder in File Explorer via shell.openPath (simulated in web preview)'
      }));
    });
  }

  // 5. Show System Info
  if (btnSystemInfo) {
    btnSystemInfo.addEventListener('click', () => {
      handleControlAction(btnSystemInfo, 'getSystemInfo', 'System Info', () => ({
        success: true,
        message: 'System specifications retrieved successfully',
        details: [
          '• Hostname:   DESKTOP-CLIENT',
          '• OS User:    ahsantalks0-cmyk',
          '• Platform:   Windows 11 Pro (10.0.22631)',
          '• CPU:        12th Gen Intel(R) Core(TM) i7-12700H',
          '• Memory:     9.42 GB free / 16.00 GB total'
        ].join('\n')
      }));
    });
  }
});
