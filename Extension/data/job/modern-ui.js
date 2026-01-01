/**
 * Modern UI Renderer for liveDownload
 * Transforms old template-based UI into modern table-based UI
 * 
 * This version maintains its own data model and handles batch downloads
 * directly, avoiding the user gesture chain issues with delegating to
 * hidden UI elements.
 */

(function() {
  'use strict';

  // ===========================================
  // OUR DATA MODEL - Single source of truth
  // ===========================================
  const streamData = new Map(); // index -> {url, meta, entry, node, isLive, selected}
  let streamIndex = 0;

  // ===========================================
  // INITIALIZATION
  // ===========================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Update window title with version
    try {
      const manifest = chrome.runtime.getManifest();
      document.title = `liveDownload v${manifest.version}`;
      console.log('[modern-ui] Window title set to:', document.title);
    } catch (e) {
      console.error('[modern-ui] Failed to set title:', e);
      document.title = 'liveDownload';
    }
    
    // Inject modern UI structure
    injectModernUI();
    
    // Override the original entry rendering
    interceptEntryCreation();
    
    // Setup recording badge
    setupRecordingBadge();
  }

  // ===========================================
  // UI INJECTION
  // ===========================================

  function injectModernUI() {
    // Get version for display
    let version = '';
    try {
      version = chrome.runtime.getManifest().version;
    } catch (e) {
      console.warn('[modern-ui] Could not get version');
    }
    
    // Create header
    const header = document.createElement('div');
    header.className = 'app-header';
    header.innerHTML = `
      <h1>liveDownload <span class="version-tag">v${version}</span></h1>
      <button class="settings-btn" id="modern-settings-btn">
        <span>⚙️</span>
        Settings
      </button>
    `;
    
    // Create main container
    const container = document.createElement('div');
    container.className = 'app-container';
    container.innerHTML = `
      <!-- Streams Section -->
      <div class="section-card" id="streams-section">
        <div class="section-header">
          <h2>Available Streams</h2>
        </div>
        <div id="streams-content">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3>No streams detected</h3>
            <p>Waiting for media streams on this page...</p>
          </div>
        </div>
      </div>

      <!-- Download Selected Button -->
      <div class="download-selected-container">
        <button class="download-selected-btn" id="download-selected-btn" disabled>
          Download Selected
        </button>
        <span class="selection-count" id="selection-count">0 selected</span>
      </div>

      <!-- Stream Information -->
      <div class="section-card" id="info-section">
        <div class="section-header">
          <h2>Stream Information</h2>
        </div>
        <table class="info-table">
          <tr>
            <td>Referrer</td>
            <td id="info-referrer">-</td>
          </tr>
          <tr>
            <td>Page Title</td>
            <td id="info-title">-</td>
          </tr>
          <tr>
            <td>Page Link</td>
            <td id="info-link">-</td>
          </tr>
        </table>
      </div>

      <!-- Recording Badge -->
      <div class="recording-badge" id="recording-badge">
        <div class="status">
          <span class="pulse"></span>
          RECORDING
        </div>
        <div class="stats" id="recording-stats">
          Segments: <span id="badge-segments">0</span><br>
          Batches: <span id="badge-batches">0</span><br>
          Duration: <span id="badge-duration">0:00:00</span>
        </div>
        <button class="stop-recording-btn" id="badge-stop-btn">⬛ Stop Recording</button>
      </div>
      
      <!-- Progress indicator for batch downloads -->
      <div class="batch-progress" id="batch-progress" style="display: none;">
        <div class="batch-progress-text" id="batch-progress-text">Downloading...</div>
        <div class="batch-progress-bar">
          <div class="batch-progress-fill" id="batch-progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `;
    
    // Insert into page
    document.body.insertBefore(header, document.body.firstChild);
    document.body.insertBefore(container, document.body.children[1]);
    
    // Hook up settings button to existing gear icon handler
    document.getElementById('modern-settings-btn').addEventListener('click', () => {
      const settingsTrigger = document.getElementById('options');
      if (settingsTrigger) {
        settingsTrigger.click();
      }
    });
    
    // Update page info
    updatePageInfo();
  }

  function updatePageInfo() {
    // Get info from footer elements
    const refererEl = document.getElementById('referer');
    const titleEl = document.getElementById('title');
    const pageEl = document.getElementById('page');
    
    if (refererEl) {
      document.getElementById('info-referrer').textContent = refererEl.textContent || '-';
    }
    if (titleEl) {
      document.getElementById('info-title').textContent = titleEl.textContent || '-';
    }
    if (pageEl) {
      document.getElementById('info-link').textContent = pageEl.textContent || '-';
    }
    
    // Watch for changes
    const observer = new MutationObserver(() => {
      if (refererEl) document.getElementById('info-referrer').textContent = refererEl.textContent || '-';
      if (titleEl) document.getElementById('info-title').textContent = titleEl.textContent || '-';
      if (pageEl) document.getElementById('info-link').textContent = pageEl.textContent || '-';
    });
    
    if (refererEl) observer.observe(refererEl, { childList: true, characterData: true, subtree: true });
    if (titleEl) observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    if (pageEl) observer.observe(pageEl, { childList: true, characterData: true, subtree: true });
  }

  // ===========================================
  // ENTRY INTERCEPTION - Capture data from original UI
  // ===========================================

  function interceptEntryCreation() {
    const hrefsContainer = document.getElementById('hrefs');
    if (!hrefsContainer) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList.contains('entry')) {
            // Hide the old entry immediately
            node.style.display = 'none';
            
            // Extract and store data in OUR data model
            const data = extractAndStoreEntry(node);
            
            // Render modern table
            renderStreamsTable();
          }
        });
      });
    });
    
    observer.observe(hrefsContainer, { childList: true });
  }

  /**
   * Extract data from original entry node and store in our data model
   */
  function extractAndStoreEntry(entryNode) {
    const index = streamIndex++;
    
    // Get references to original elements
    const checkbox = entryNode.querySelector('[data-id="selected"]');
    const downloadBtn = entryNode.querySelector('input[type="submit"]');
    
    // USE the meta and entry objects that build.js attached to the node!
    // These have the correct filename info
    const meta = entryNode.meta || {
      name: entryNode.querySelector('[data-id="name"]')?.textContent || '',
      gname: entryNode.querySelector('[data-id="extracted-name"]')?.textContent || '',
      ext: entryNode.querySelector('[data-id="ext"]')?.textContent || '',
      index: 0
    };
    
    const entry = entryNode.entry || {
      url: entryNode.querySelector('[data-id="href"]')?.textContent || ''
    };
    
    // For display purposes, get text from DOM
    const sizeEl = entryNode.querySelector('[data-id="size"]');
    
    // Store in our data model
    const data = {
      index,
      url: entry.url,
      meta,  // Use the actual meta object from build.js
      entry, // Use the actual entry object from build.js
      node: entryNode,
      checkbox,
      downloadBtn,
      name: meta.gname || meta.name || '',
      extractedName: entryNode.querySelector('[data-id="extracted-name"]')?.textContent || '',
      ext: meta.ext || '',
      size: sizeEl?.textContent || '',
      href: entry.url,
      isLive: false,
      selected: false
    };
    
    streamData.set(index, data);
    
    console.log(`[modern-ui] Stored stream ${index}:`, meta.gname || meta.name || entry.url.substring(0, 50));
    
    return data;
  }

  // ===========================================
  // TABLE RENDERING
  // ===========================================

  async function renderStreamsTable() {
    const contentEl = document.getElementById('streams-content');
    if (!contentEl) return;
    
    if (streamData.size === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3>No streams detected</h3>
          <p>Waiting for media streams on this page...</p>
        </div>
      `;
      return;
    }
    
    // Check for live streams
    for (const [index, data] of streamData) {
      if (data.ext === 'm3u8' && window.LiveMonitor) {
        try {
          data.isLive = await window.LiveMonitor.isLiveStream(data.url);
        } catch (e) {
          console.warn('[modern-ui] Live check failed:', e);
          data.isLive = false;
        }
      }
    }
    
    // Build table HTML
    let tableHTML = `
      <table class="streams-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all-modern" title="Select all"></th>
            <th>Name</th>
            <th>Segment</th>
            <th>Format</th>
            <th>Size</th>
            <th>Link</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const [index, data] of streamData) {
      const rowClass = data.isLive ? 'live-stream' : '';
      
      tableHTML += `
        <tr class="${rowClass}" data-index="${index}">
          <td><input type="checkbox" class="stream-checkbox" data-index="${index}" ${data.selected ? 'checked' : ''}></td>
          <td><span class="stream-name">${escapeHtml(data.name)}</span></td>
          <td><span class="segment-type">${escapeHtml(data.extractedName)}</span></td>
          <td><span class="format-badge ${data.ext}">${escapeHtml(data.ext)}</span></td>
          <td><span class="stream-size">${escapeHtml(data.size)}</span></td>
          <td><span class="stream-link" title="${escapeHtml(data.href)}">${escapeHtml(truncate(data.href, 40))}</span></td>
          <td>
            <button class="action-btn ${data.isLive ? 'record' : 'download'}" data-index="${index}">
              ${data.isLive ? '🔴 Record' : 'Download'}
            </button>
          </td>
        </tr>
      `;
    }
    
    tableHTML += `
        </tbody>
      </table>
    `;
    
    contentEl.innerHTML = tableHTML;
    
    // Hook up events
    setupTableEvents();
  }

  // ===========================================
  // EVENT HANDLERS
  // ===========================================

  function setupTableEvents() {
    // Select all checkbox
    const selectAll = document.getElementById('select-all-modern');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        
        document.querySelectorAll('.stream-checkbox').forEach(cb => {
          cb.checked = isChecked;
          const index = parseInt(cb.dataset.index);
          const data = streamData.get(index);
          if (data) {
            data.selected = isChecked;
          }
        });
        
        updateSelectionCount();
      });
    }
    
    // Individual checkboxes
    document.querySelectorAll('.stream-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const data = streamData.get(index);
        if (data) {
          data.selected = e.target.checked;
        }
        updateSelectionCount();
      });
    });
    
    // Action buttons (individual download/record)
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const data = streamData.get(index);
        if (data && data.downloadBtn) {
          // For individual downloads, use original button (preserves user gesture)
          data.downloadBtn.click();
        }
      });
    });
    
    // Download Selected button - OUR OWN IMPLEMENTATION
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    if (downloadSelectedBtn) {
      downloadSelectedBtn.addEventListener('click', handleBatchDownload);
    }
  }

  function updateSelectionCount() {
    const selectedCount = Array.from(streamData.values()).filter(d => d.selected).length;
    
    const countEl = document.getElementById('selection-count');
    const btnEl = document.getElementById('download-selected-btn');
    
    if (countEl) {
      countEl.textContent = `${selectedCount} selected`;
    }
    
    if (btnEl) {
      btnEl.disabled = selectedCount === 0;
    }
  }

  // ===========================================
  // BATCH DOWNLOAD - Our own implementation
  // ===========================================

  /**
   * Handle batch download - called directly from user click
   * This preserves the user gesture for showDirectoryPicker()
   */
  async function handleBatchDownload(e) {
    e.preventDefault();
    
    // Get selected streams
    const selected = Array.from(streamData.values()).filter(d => d.selected);
    
    if (selected.length === 0) {
      console.log('[modern-ui] No streams selected');
      return;
    }
    
    console.log(`[modern-ui] Batch download: ${selected.length} streams`);
    
    // IMPORTANT: Save current global directory setting so we don't overwrite it
    const savedGlobalDir = window._liveDownloadDirectory;
    
    try {
      // CRITICAL: Call showDirectoryPicker directly from user gesture
      const dir = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      
      console.log('[modern-ui] Directory selected:', dir.name);
      
      // Show progress UI
      showBatchProgress(0, selected.length);
      
      // Get existing filenames to handle duplicates
      const existingNames = {};
      for await (const file of dir.values()) {
        if (file.kind === 'file') {
          existingNames[file.name] = 0;
        }
      }
      
      // Generate unique filenames for all selected streams using helper.options
      const downloadQueue = [];
      for (const data of selected) {
        // Use helper.options() like the original code does - it knows how to generate proper names
        const options = helper.options({ meta: data.meta });
        let rawFilename = options.suggestedName || 'Untitled.ts';
        
        console.log(`[modern-ui] Raw filename from helper.options: "${rawFilename}"`);
        
        // SANITIZE the filename - remove invalid characters like / \ : * ? " < > |
        // Do this INLINE to ensure it happens
        let filename = rawFilename
          .replace(/[\/\\:*?"<>|]/g, '_')  // Replace forbidden chars with underscore
          .replace(/\s+/g, ' ')             // Collapse multiple spaces
          .trim();                          // Remove leading/trailing whitespace
        
        // Limit length
        if (filename.length > 200) {
          const ext = filename.lastIndexOf('.');
          if (ext > 0) {
            filename = filename.substring(0, 196) + filename.substring(ext);
          } else {
            filename = filename.substring(0, 200);
          }
        }
        
        console.log(`[modern-ui] Sanitized filename: "${filename}"`);
        
        // Ensure it has an extension
        if (!filename.includes('.')) {
          filename += '.ts';
        }
        
        // Handle duplicates
        if (filename in existingNames) {
          existingNames[filename]++;
          const ext = filename.lastIndexOf('.');
          if (ext > 0) {
            filename = filename.substring(0, ext) + ' - ' + existingNames[filename] + filename.substring(ext);
          } else {
            filename = filename + ' - ' + existingNames[filename];
          }
        } else {
          existingNames[filename] = 0;
        }
        existingNames[filename] = 0;
        
        downloadQueue.push({
          data,
          filename
        });
        
        console.log(`[modern-ui] Final queued filename: "${filename}"`);
      }
      
      // Download sequentially
      let completed = 0;
      for (const item of downloadQueue) {
        try {
          updateBatchProgress(completed, downloadQueue.length, item.filename);
          
          // Create file handle
          const fileHandle = await dir.getFileHandle(item.filename, { create: true });
          
          // Set the global aFile so the original code uses our file handle
          self.aFile = fileHandle;
          self.aFile.stat = {
            index: completed + 1,
            total: downloadQueue.length
          };
          
          // Click the original download button and wait for completion
          await downloadSingleStream(item.data, fileHandle);
          
          completed++;
          updateBatchProgress(completed, downloadQueue.length, item.filename);
          
          console.log(`[modern-ui] Completed ${completed}/${downloadQueue.length}: ${item.filename}`);
          
        } catch (err) {
          console.error(`[modern-ui] Failed to download ${item.filename}:`, err);
          // Continue with next file
          completed++;
        }
      }
      
      // Cleanup
      delete self.aFile;
      hideBatchProgress();
      
      showNotification(`Downloaded ${completed} of ${downloadQueue.length} files`, 'success');
      
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[modern-ui] User cancelled directory picker');
      } else {
        console.error('[modern-ui] Batch download error:', err);
        showNotification(`Download failed: ${err.message}`, 'error');
      }
      hideBatchProgress();
    } finally {
      // IMPORTANT: Restore the original global directory setting
      window._liveDownloadDirectory = savedGlobalDir;
    }
  }

  /**
   * Download a single stream using the original infrastructure
   */
  function downloadSingleStream(data, fileHandle) {
    return new Promise((resolve, reject) => {
      // Set up completion listener
      const onComplete = () => {
        events.after.delete(onComplete);
        resolve();
      };
      
      // Check if events.after exists (from original code)
      if (typeof events !== 'undefined' && events.after) {
        events.after.add(onComplete);
      }
      
      // Set global file handle for original code to use
      self.aFile = fileHandle;
      
      // Click original download button
      if (data.downloadBtn) {
        data.downloadBtn.click();
      } else {
        reject(new Error('No download button found'));
      }
      
      // Timeout after 5 minutes per file
      setTimeout(() => {
        if (typeof events !== 'undefined' && events.after) {
          events.after.delete(onComplete);
        }
        reject(new Error('Download timeout'));
      }, 300000);
    });
  }

  // ===========================================
  // PROGRESS UI
  // ===========================================

  function showBatchProgress(current, total) {
    const progressEl = document.getElementById('batch-progress');
    if (progressEl) {
      progressEl.style.display = 'block';
      updateBatchProgress(current, total, '');
    }
  }

  function updateBatchProgress(current, total, filename) {
    const textEl = document.getElementById('batch-progress-text');
    const fillEl = document.getElementById('batch-progress-fill');
    
    if (textEl) {
      textEl.textContent = `Downloading ${current + 1} of ${total}: ${filename}`;
    }
    
    if (fillEl) {
      const percent = total > 0 ? (current / total) * 100 : 0;
      fillEl.style.width = `${percent}%`;
    }
  }

  function hideBatchProgress() {
    const progressEl = document.getElementById('batch-progress');
    if (progressEl) {
      progressEl.style.display = 'none';
    }
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    
    notification.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      max-width: 400px;
      padding: 12px 16px;
      background: ${colors[type] || colors.info};
      color: white;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10001;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // ===========================================
  // RECORDING BADGE
  // ===========================================

  function setupRecordingBadge() {
    const liveControls = document.getElementById('live-controls');
    const recordingBadge = document.getElementById('recording-badge');
    
    if (!liveControls || !recordingBadge) return;
    
    const observer = new MutationObserver(() => {
      if (liveControls.style.display !== 'none') {
        recordingBadge.classList.add('active');
        
        const segments = document.getElementById('live-segment-count')?.textContent || '0';
        const batches = document.getElementById('live-batch-count')?.textContent || '0';
        const duration = document.getElementById('live-duration')?.textContent || '0:00:00';
        
        document.getElementById('badge-segments').textContent = segments;
        document.getElementById('badge-batches').textContent = batches;
        document.getElementById('badge-duration').textContent = duration;
      } else {
        recordingBadge.classList.remove('active');
      }
    });
    
    observer.observe(liveControls, { attributes: true, attributeFilter: ['style'] });
    
    // Sync stats continuously
    setInterval(() => {
      if (recordingBadge.classList.contains('active')) {
        const segments = document.getElementById('live-segment-count')?.textContent || '0';
        const batches = document.getElementById('live-batch-count')?.textContent || '0';
        const duration = document.getElementById('live-duration')?.textContent || '0:00:00';
        
        document.getElementById('badge-segments').textContent = segments;
        document.getElementById('badge-batches').textContent = batches;
        document.getElementById('badge-duration').textContent = duration;
      }
    }, 1000);
    
    // Hook up stop button
    document.getElementById('badge-stop-btn').addEventListener('click', () => {
      document.getElementById('stop-recording')?.click();
    });
  }

  /**
   * Sanitize filename - remove/replace characters not allowed in filenames
   */
  function sanitizeFilename(filename) {
    if (!filename) return 'Untitled';
    
    // Replace characters not allowed in Windows/Mac/Linux filenames
    // Windows: \ / : * ? " < > |
    // Mac/Linux: / and null
    return filename
      .replace(/[\/\\:*?"<>|]/g, '_')  // Replace forbidden chars with underscore
      .replace(/\s+/g, ' ')             // Collapse multiple spaces
      .trim()                           // Remove leading/trailing whitespace
      .substring(0, 200);               // Limit length (some filesystems have limits)
  }

  // ===========================================
  // UTILITIES
  // ===========================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (!str) return '';
    if (str.length <= len) return str;
    return str.substring(0, len) + '...';
  }

})();
