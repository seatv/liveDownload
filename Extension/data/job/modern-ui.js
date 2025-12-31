/**
 * Modern UI Renderer for liveDownload
 * Transforms old template-based UI into modern table-based UI
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
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

  function injectModernUI() {
    // Create header
    const header = document.createElement('div');
    header.className = 'app-header';
    header.innerHTML = `
      <h1>liveDownload</h1>
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

  let tableCreated = false;
  let streamEntries = [];

  function interceptEntryCreation() {
    // Watch for entries being added to #hrefs
    const hrefsContainer = document.getElementById('hrefs');
    if (!hrefsContainer) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList.contains('entry')) {
            // Hide the old entry immediately
            node.style.display = 'none';
            
            // Extract data from the old entry
            const entryData = extractEntryData(node);
            streamEntries.push(entryData);
            
            // Render modern table
            renderStreamsTable();
          }
        });
      });
    });
    
    observer.observe(hrefsContainer, { childList: true });
  }

  function extractEntryData(entryNode) {
    const checkbox = entryNode.querySelector('[data-id="selected"]');
    const name = entryNode.querySelector('[data-id="name"]');
    const extractedName = entryNode.querySelector('[data-id="extracted-name"]');
    const ext = entryNode.querySelector('[data-id="ext"]');
    const size = entryNode.querySelector('[data-id="size"]');
    const href = entryNode.querySelector('[data-id="href"]');
    const downloadBtn = entryNode.querySelector('input[type="submit"]');
    
    return {
      node: entryNode,
      checkbox: checkbox,
      name: name?.textContent || '',
      extractedName: extractedName?.textContent || '',
      ext: ext?.textContent || '',
      size: size?.textContent || '',
      href: href?.textContent || '',
      downloadBtn: downloadBtn,
      isLive: false // Will be detected
    };
  }

  async function renderStreamsTable() {
    const contentEl = document.getElementById('streams-content');
    if (!contentEl) return;
    
    if (streamEntries.length === 0) {
      // Show empty state
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
    
    // Check if any are live streams (cache results by URL)
    const liveCheckCache = {};
    for (let entry of streamEntries) {
      if (entry.ext === 'm3u8' && window.LiveMonitor) {
        // Use cache to avoid re-checking same URL
        if (liveCheckCache[entry.href] === undefined) {
          try {
            liveCheckCache[entry.href] = await window.LiveMonitor.isLiveStream(entry.href);
          } catch (e) {
            console.warn('[modern-ui] Live check failed for:', entry.href, e);
            liveCheckCache[entry.href] = false;
          }
        }
        entry.isLive = liveCheckCache[entry.href];
      } else {
        entry.isLive = false;
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
    
    streamEntries.forEach((entry, index) => {
      const segmentType = entry.extractedName || '';
      const isLive = entry.isLive;
      const rowClass = isLive ? 'live-stream' : '';
      
      tableHTML += `
        <tr class="${rowClass}">
          <td><input type="checkbox" class="stream-checkbox" data-index="${index}"></td>
          <td><span class="stream-name">${escapeHtml(entry.name)}</span></td>
          <td><span class="segment-type">${escapeHtml(segmentType)}</span></td>
          <td><span class="format-badge ${entry.ext}">${escapeHtml(entry.ext)}</span></td>
          <td><span class="stream-size">${escapeHtml(entry.size)}</span></td>
          <td><span class="stream-link" title="${escapeHtml(entry.href)}">${escapeHtml(truncate(entry.href, 40))}</span></td>
          <td>
            <button class="action-btn ${isLive ? 'record' : 'download'}" data-index="${index}">
              ${isLive ? '🔴 Record' : 'Download'}
            </button>
          </td>
        </tr>
      `;
    });
    
    tableHTML += `
        </tbody>
      </table>
    `;
    
    contentEl.innerHTML = tableHTML;
    
    // Hook up events
    setupTableEvents();
  }

  function setupTableEvents() {
    // Select all checkbox
    const selectAll = document.getElementById('select-all-modern');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.stream-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          // Sync with original checkbox
          const index = parseInt(cb.dataset.index);
          if (streamEntries[index]) {
            streamEntries[index].checkbox.checked = e.target.checked;
            // Trigger change event so tools.js updates button state
            streamEntries[index].checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        updateSelectionCount();
      });
    }
    
    // Individual checkboxes
    document.querySelectorAll('.stream-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (streamEntries[index]) {
          streamEntries[index].checkbox.checked = e.target.checked;
          // Trigger change event on original checkbox so tools.js updates button state
          streamEntries[index].checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateSelectionCount();
      });
    });
    
    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (streamEntries[index]) {
          // Trigger the original download button
          streamEntries[index].downloadBtn.click();
        }
      });
    });
    
    // Download Selected button
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    if (downloadSelectedBtn) {
      const originalDownloadAll = document.getElementById('download-all');
      let isProcessing = false; // Lock to prevent re-entry
      
      downloadSelectedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Prevent re-entry
        if (isProcessing) {
          console.log('[modern-ui] Download already in progress, ignoring click');
          return;
        }
        
        isProcessing = true;
        console.log('[modern-ui] Download Selected clicked');
        
        // Click the actual DOM element to preserve user gesture
        if (originalDownloadAll) {
          console.log('[modern-ui] Original button disabled:', originalDownloadAll.disabled);
          // Enable button before clicking
          originalDownloadAll.disabled = false;
          console.log('[modern-ui] Clicking original download-all DOM element');
          originalDownloadAll.click();
        } else {
          console.error('[modern-ui] Original download-all button not found');
        }
        
        // Reset lock after a delay to allow the download to start
        setTimeout(() => {
          isProcessing = false;
          console.log('[modern-ui] Download lock released');
        }, 1000);
      });
    }
  }

  function updateSelectionCount() {
    const checkboxes = document.querySelectorAll('.stream-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    const countEl = document.getElementById('selection-count');
    const btnEl = document.getElementById('download-selected-btn');
    
    if (countEl) {
      countEl.textContent = `${checkedCount} selected`;
    }
    
    if (btnEl) {
      btnEl.disabled = checkedCount === 0;
    }
  }

  function setupRecordingBadge() {
    // Watch for live controls to show/hide recording badge
    const liveControls = document.getElementById('live-controls');
    const recordingBadge = document.getElementById('recording-badge');
    
    if (!liveControls || !recordingBadge) return;
    
    const observer = new MutationObserver(() => {
      if (liveControls.style.display !== 'none') {
        recordingBadge.classList.add('active');
        
        // Sync stats
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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (str.length <= len) return str;
    return str.substring(0, len) + '...';
  }

})();
