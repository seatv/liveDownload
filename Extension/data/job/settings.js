/**
 * Settings Panel Management
 * Handles UI, storage, and directory permissions for liveDownload
 */

(function() {
  'use strict';

  // Settings keys
  const SETTINGS_KEYS = {
    ROOT_DIRECTORY: 'liveDownload_rootDirectory',
    BATCH_SIZE: 'liveDownload_batchSize',
    AUTO_CONCAT: 'liveDownload_autoConcat',
    LIVE_THREADS: 'liveDownload_liveThreads',
    FILENAME: 'filename',
    THREADS: 'threads',
    ERROR_TOLERANCE: 'error-tolerance',
    DEFAULT_FORMAT: 'default-format',
    QUALITY: 'quality',
    AUTO_CLOSE: 'autoclose',
    MIME_WATCH: 'mime-watch',
    ONLINE_RESOLVE_NAME: 'online-resolve-name'
  };

  // Default values
  const DEFAULTS = {
    [SETTINGS_KEYS.BATCH_SIZE]: 20,
    [SETTINGS_KEYS.AUTO_CONCAT]: true,
    [SETTINGS_KEYS.LIVE_THREADS]: 1,
    [SETTINGS_KEYS.FILENAME]: '[title]',
    [SETTINGS_KEYS.THREADS]: 3,
    [SETTINGS_KEYS.ERROR_TOLERANCE]: 30,
    [SETTINGS_KEYS.DEFAULT_FORMAT]: 'ts',
    [SETTINGS_KEYS.QUALITY]: 'selector',
    [SETTINGS_KEYS.AUTO_CLOSE]: false,
    [SETTINGS_KEYS.MIME_WATCH]: false,
    [SETTINGS_KEYS.ONLINE_RESOLVE_NAME]: true
  };

  let currentSettings = {};
  let rootDirectoryHandle = null;
  
  // IndexedDB for storing directory handle (can't use chrome.storage for handles)
  const DB_NAME = 'liveDownload';
  const DB_VERSION = 1;
  const STORE_NAME = 'handles';
  
  async function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }
  
  async function saveDirectoryHandle(handle) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(handle, 'rootDirectory');
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      console.log('[Settings] Directory handle saved to IndexedDB');
    } catch (e) {
      console.error('[Settings] Failed to save directory handle:', e);
    }
  }
  
  async function loadDirectoryHandle() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('rootDirectory');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[Settings] Failed to load directory handle:', e);
      return null;
    }
  }

  /**
   * Initialize settings panel
   */
  function init() {
    // Find or create gear icon
    setupGearIcon();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load current settings
    loadSettings();
  }

  /**
   * Setup gear icon in footer
   */
  function setupGearIcon() {
    // Use existing #options gear icon from original plugin
    const gearIcon = document.getElementById('options');
    if (!gearIcon) {
      console.warn('[Settings] #options gear icon not found');
      return;
    }
    
    // Remove any existing click handlers and set up ours
    gearIcon.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSettings();
    };
    
    console.log('[Settings] Hooked into existing gear icon');
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // Gear icon click is handled in setupGearIcon()
    
    // Overlay click (close)
    document.getElementById('settings-overlay')?.addEventListener('click', closeSettings);
    
    // Cancel button
    document.getElementById('settings-cancel')?.addEventListener('click', closeSettings);
    
    // Save button
    document.getElementById('settings-save')?.addEventListener('click', saveSettings);
    
    // Choose directory button
    document.getElementById('choose-root-directory')?.addEventListener('click', chooseDirectory);
    
    // Batch size slider
    const batchSlider = document.getElementById('batch-size');
    const batchValue = document.getElementById('batch-size-value');
    if (batchSlider && batchValue) {
      batchSlider.addEventListener('input', (e) => {
        batchValue.textContent = e.target.value;
      });
    }
  }

  /**
   * Load settings from storage
   */
  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(Object.values(SETTINGS_KEYS));
      currentSettings = { ...DEFAULTS, ...stored };
      
      // Load directory handle from IndexedDB
      const handle = await loadDirectoryHandle();
      if (handle) {
        try {
          // Verify we still have permission
          const permission = await handle.queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            rootDirectoryHandle = handle;
            console.log('[Settings] Loaded directory handle from IndexedDB');
          } else {
            // Request permission again
            const newPermission = await handle.requestPermission({ mode: 'readwrite' });
            if (newPermission === 'granted') {
              rootDirectoryHandle = handle;
              console.log('[Settings] Re-granted permission for directory handle');
            } else {
              console.warn('[Settings] Permission denied for stored directory');
              rootDirectoryHandle = null;
            }
          }
        } catch (e) {
          console.warn('[Settings] Root directory no longer accessible:', e);
          rootDirectoryHandle = null;
        }
      }
      
      updateUI();
    } catch (e) {
      console.error('[Settings] Error loading settings:', e);
    }
  }

  /**
   * Update UI with current settings
   */
  function updateUI() {
    // Root directory
    const dirDisplay = document.getElementById('root-directory-display');
    if (dirDisplay) {
      if (rootDirectoryHandle) {
        dirDisplay.textContent = rootDirectoryHandle.name || 'Selected';
        dirDisplay.classList.remove('empty');
      } else {
        dirDisplay.textContent = 'Not selected';
        dirDisplay.classList.add('empty');
      }
    }
    
    // Filename format
    const filename = document.getElementById('settings-filename');
    if (filename) filename.value = currentSettings[SETTINGS_KEYS.FILENAME];
    
    // Batch size
    const batchSlider = document.getElementById('batch-size');
    const batchValue = document.getElementById('batch-size-value');
    if (batchSlider && batchValue) {
      batchSlider.value = currentSettings[SETTINGS_KEYS.BATCH_SIZE];
      batchValue.textContent = currentSettings[SETTINGS_KEYS.BATCH_SIZE];
    }
    
    // Live threads
    const liveThreads = document.getElementById('live-threads');
    if (liveThreads) liveThreads.value = currentSettings[SETTINGS_KEYS.LIVE_THREADS];
    
    // Checkboxes
    const autoConcat = document.getElementById('auto-concat');
    if (autoConcat) autoConcat.checked = currentSettings[SETTINGS_KEYS.AUTO_CONCAT];
    
    const autoClose = document.getElementById('settings-autoclose');
    if (autoClose) autoClose.checked = currentSettings[SETTINGS_KEYS.AUTO_CLOSE];
    
    const mimeWatch = document.getElementById('settings-mime-watch');
    if (mimeWatch) mimeWatch.checked = currentSettings[SETTINGS_KEYS.MIME_WATCH];
    
    const onlineResolve = document.getElementById('settings-online-resolve-name');
    if (onlineResolve) onlineResolve.checked = currentSettings[SETTINGS_KEYS.ONLINE_RESOLVE_NAME];
    
    // Numbers
    const threads = document.getElementById('settings-threads');
    if (threads) threads.value = currentSettings[SETTINGS_KEYS.THREADS];
    
    const errorTolerance = document.getElementById('settings-error-tolerance');
    if (errorTolerance) errorTolerance.value = currentSettings[SETTINGS_KEYS.ERROR_TOLERANCE];
    
    // Selects
    const format = document.getElementById('settings-default-format');
    if (format) format.value = currentSettings[SETTINGS_KEYS.DEFAULT_FORMAT];
    
    const quality = document.getElementById('settings-quality');
    if (quality) quality.value = currentSettings[SETTINGS_KEYS.QUALITY];
  }

  /**
   * Open settings panel
   */
  function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    const panel = document.getElementById('settings-panel');
    
    if (overlay) overlay.classList.add('visible');
    if (panel) {
      // Small delay for animation
      setTimeout(() => panel.classList.add('visible'), 10);
    }
  }

  /**
   * Close settings panel
   */
  function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    const panel = document.getElementById('settings-panel');
    
    if (panel) panel.classList.remove('visible');
    
    // Wait for animation
    setTimeout(() => {
      if (overlay) overlay.classList.remove('visible');
    }, 300);
  }

  /**
   * Choose root directory
   */
  async function chooseDirectory() {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });
      
      rootDirectoryHandle = dirHandle;
      
      // Update display
      const dirDisplay = document.getElementById('root-directory-display');
      if (dirDisplay) {
        dirDisplay.textContent = dirHandle.name;
        dirDisplay.classList.remove('empty');
      }
      
      console.log('[Settings] Directory selected:', dirHandle.name);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('[Settings] Error selecting directory:', e);
        alert('Failed to select directory: ' + e.message);
      }
    }
  }

  /**
   * Save settings
   */
  async function saveSettings() {
    try {
      // Gather values from UI
      const newSettings = {
        [SETTINGS_KEYS.FILENAME]: document.getElementById('settings-filename')?.value || '[title]',
        [SETTINGS_KEYS.BATCH_SIZE]: parseInt(document.getElementById('batch-size')?.value || 50),
        [SETTINGS_KEYS.AUTO_CONCAT]: document.getElementById('auto-concat')?.checked || false,
        [SETTINGS_KEYS.LIVE_THREADS]: parseInt(document.getElementById('live-threads')?.value || 1),
        [SETTINGS_KEYS.THREADS]: parseInt(document.getElementById('settings-threads')?.value || 3),
        [SETTINGS_KEYS.ERROR_TOLERANCE]: parseInt(document.getElementById('settings-error-tolerance')?.value || 30),
        [SETTINGS_KEYS.DEFAULT_FORMAT]: document.getElementById('settings-default-format')?.value || 'ts',
        [SETTINGS_KEYS.QUALITY]: document.getElementById('settings-quality')?.value || 'selector',
        [SETTINGS_KEYS.AUTO_CLOSE]: document.getElementById('settings-autoclose')?.checked || false,
        [SETTINGS_KEYS.MIME_WATCH]: document.getElementById('settings-mime-watch')?.checked || false,
        [SETTINGS_KEYS.ONLINE_RESOLVE_NAME]: document.getElementById('settings-online-resolve-name')?.checked || false
      };
      
      // Save directory handle to IndexedDB (can't serialize to chrome.storage)
      if (rootDirectoryHandle) {
        await saveDirectoryHandle(rootDirectoryHandle);
      }
      
      // Save other settings to chrome.storage
      await chrome.storage.local.set(newSettings);
      
      currentSettings = newSettings;
      
      console.log('[Settings] Settings saved successfully');
      
      // Close panel
      closeSettings();
      
      // Show confirmation
      const saveBtn = document.getElementById('settings-save');
      if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✓ Saved!';
        setTimeout(() => {
          saveBtn.textContent = originalText;
        }, 2000);
      }
    } catch (e) {
      console.error('[Settings] Error saving settings:', e);
      alert('Failed to save settings: ' + e.message);
    }
  }

  /**
   * Get current settings (for use by other modules)
   */
  window.getSettings = function() {
    return currentSettings;
  };

  /**
   * Get root directory handle (for use by live-integration.js)
   */
  window.getRootDirectory = function() {
    return rootDirectoryHandle;
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
