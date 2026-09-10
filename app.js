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

  const isElectron = Boolean(window.jarvisAPI);

  // Initialize version
  let appVersion = '1.0.0';
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

  // Button interaction
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
        // Web preview simulation
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
});
