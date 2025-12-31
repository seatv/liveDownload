/**
 * liveDownload - Live Stream Recording Extension
 * Extends Live Stream Downloader to support continuous live stream recording
 * 
 * Strategy:
 * - Download segments in batches to separate numbered files
 * - Each batch is a clean myGet.fetch() call
 * - Concatenate all batches at the end
 * - Clean up component files
 * 
 * License: AGPL 3.0
 */

(function() {
  'use strict';

  console.log('[liveDownload] Loading...');

  // Configuration
  const POLL_INTERVAL = 3000; // 3 seconds
  
  // Get batch size from settings or use default
  function getBatchSize() {
    const settings = window.getSettings?.();
    return settings?.liveDownload_batchSize || 20;
  }

  /**
   * Check if URL is a live stream
   */
  async function isLiveStream(url) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      const text = await response.text();
      
      console.log('[liveDownload] Checking stream:', url.substring(0, 60) + '...');
      
      // Check if this is a master playlist (contains stream variants)
      const isMasterPlaylist = text.includes('#EXT-X-STREAM-INF');
      
      const hasEndList = text.includes('#EXT-X-ENDLIST');
      const hasVODType = text.includes('#EXT-X-PLAYLIST-TYPE:VOD');
      const hasEventType = text.includes('#EXT-X-PLAYLIST-TYPE:EVENT');
      
      console.log('[liveDownload]  - Master playlist:', isMasterPlaylist);
      console.log('[liveDownload]  - ENDLIST:', hasEndList);
      console.log('[liveDownload]  - VOD type:', hasVODType);
      console.log('[liveDownload]  - EVENT type:', hasEventType);
      
      // Master playlists are not "live streams" themselves - they just point to streams
      if (isMasterPlaylist) {
        console.log('[liveDownload]  → Master playlist, not a live stream');
        return false;
      }
      
      // Media playlists: check for VOD markers
      if (hasEndList) return false;
      if (hasVODType) return false;
      
      return true; // No end markers = live
    } catch (e) {
      console.error('[liveDownload] Error checking stream type:', e);
      return false;
    }
  }

  /**
   * LiveMonitor - Manages batch downloads for live streams
   */
  class LiveMonitor {
    constructor(manifestUrl, baseFilename, codec) {
      this.url = manifestUrl;
      this.baseFilename = baseFilename;
      this.codec = codec;
      this.active = false;
      this.batchNumber = 0;
      this.seen = new Set();
      this.pendingSegments = [];
      this.batchFiles = [];
      this.directoryHandle = null;
      this.componentDir = null;
      this.finalFileHandle = null;
      this.timer = null;
      this.totalSegments = 0;
    }

    async requestDirectoryAccess() {
      // Check if we already have directory access in this session
      if (window._liveDownloadDirectory) {
        this.directoryHandle = window._liveDownloadDirectory;
        console.log('[liveDownload] Using cached directory');
        return true;
      }
      
      // Try to get directory from settings
      const savedDirectory = window.getRootDirectory?.();
      if (savedDirectory) {
        try {
          // Verify we still have permission
          const permission = await savedDirectory.queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            this.directoryHandle = savedDirectory;
            window._liveDownloadDirectory = savedDirectory;
            console.log('[liveDownload] Using directory from settings');
            return true;
          }
        } catch (e) {
          console.warn('[liveDownload] Saved directory no longer accessible:', e);
        }
      }
      
      try {
        // Ask for directory
        this.directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads'
        });
        
        // Cache for other parallel recordings
        window._liveDownloadDirectory = this.directoryHandle;
        
        console.log('[liveDownload] Directory selected and cached');
        return true;
      } catch (e) {
        console.error('[liveDownload] Directory access denied', e);
        return false;
      }
    }

    async createComponentDirectory() {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const dirname = `${this.baseFilename}_${timestamp}_components`;
      
      this.componentDir = await this.directoryHandle.getDirectoryHandle(dirname, { create: true });
      console.log('[liveDownload] Component directory:', dirname);
      return this.componentDir;
    }

    async start(initialSegments, finalFileHandle) {
      this.active = true;
      this.finalFileHandle = finalFileHandle;
      this.startTime = Date.now();
      
      // Show live UI
      this.showUI();
      
      if (!await this.requestDirectoryAccess()) {
        throw new Error('Directory access required');
      }

      await this.createComponentDirectory();

      // Track initial segments
      for (const seg of initialSegments) {
        const uri = seg.url || seg.uri;
        if (uri) {
          this.seen.add(uri);
          this.pendingSegments.push(seg);
          this.totalSegments++;
        }
      }

      console.log(`[liveDownload] Started with ${this.totalSegments} initial segments`);
      this.updateUI();

      // Download first batch
      await this.downloadBatch();

      // Start polling
      this.timer = setInterval(() => this.check(), POLL_INTERVAL);
      
      // Start duration timer
      this.durationTimer = setInterval(() => this.updateDuration(), 1000);
    }

    showUI() {
      const controls = document.getElementById('live-controls');
      if (controls) {
        controls.style.display = 'block';
        
        // Set window title
        document.title = `🔴 Recording: ${this.baseFilename}`;
        
        // Setup stop button
        const stopBtn = document.getElementById('stop-recording');
        if (stopBtn) {
          stopBtn.onclick = () => this.userStop();
        }
      }
    }

    hideUI() {
      const controls = document.getElementById('live-controls');
      if (controls) {
        controls.style.display = 'none';
      }
    }

    updateUI() {
      const segCount = document.getElementById('live-segment-count');
      const batchCount = document.getElementById('live-batch-count');
      
      if (segCount) segCount.textContent = this.totalSegments;
      if (batchCount) batchCount.textContent = this.batchFiles.length;
    }

    updateDuration() {
      const durationEl = document.getElementById('live-duration');
      if (!durationEl || !this.startTime) return;
      
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      
      durationEl.textContent = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    async userStop() {
      if (!confirm('Stop recording and save what has been recorded so far?')) {
        return;
      }
      
      console.log('[liveDownload] User requested stop');
      await this.stop();
    }

    async check() {
      if (!this.active) return;

      try {
        const response = await fetch(this.url, {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const text = await response.text();

        // Check for stream end
        if (text.includes('#EXT-X-ENDLIST')) {
          console.log('[liveDownload] Stream ended (ENDLIST)');
          await this.stop();
          return;
        }

        // Parse for new segments
        const parser = new m3u8Parser.Parser();
        parser.push(text);
        parser.end();

        const manifest = parser.manifest;
        if (manifest.segments) {
          let newCount = 0;
          
          for (const seg of manifest.segments) {
            // Resolve URL
            const uri = new URL(seg.uri, this.url).href;
            seg.resolvedUri = uri;
            
            if (!this.seen.has(uri)) {
              this.seen.add(uri);
              this.pendingSegments.push(seg);
              this.totalSegments++;
              newCount++;
            }
          }

          if (newCount > 0) {
            console.log(`[liveDownload] +${newCount} segments (total: ${this.totalSegments}, pending: ${this.pendingSegments.length})`);
          }

          // Download batch if we have enough
          if (this.pendingSegments.length >= getBatchSize()) {
            await this.downloadBatch();
          }
        }

      } catch (e) {
        console.error('[liveDownload] Error during check:', e);
      }
    }

    async downloadBatch() {
      if (this.pendingSegments.length === 0) return;

      this.batchNumber++;
      const batchSegments = this.pendingSegments.splice(0, getBatchSize());
      const batchFilename = `${this.baseFilename}_${String(this.batchNumber).padStart(3, '0')}.ts`;
      
      console.log(`[liveDownload] Batch ${this.batchNumber}: ${batchSegments.length} segments → ${batchFilename}`);

      try {
        const fileHandle = await this.componentDir.getFileHandle(batchFilename, { create: true });
        
        this.batchFiles.push({
          handle: fileHandle,
          name: batchFilename
        });

        // Create new MyGet for this batch
        const myGet = new MyGet();
        myGet.meta['base-codec'] = this.codec;
        
        // Use live-specific thread count from settings
        const settings = await chrome.storage.local.get({
          'liveDownload_liveThreads': 1,
          'thread-timeout': MyGet.OPTIONS['thread-timeout']
        });
        
        myGet.options['threads'] = settings.liveDownload_liveThreads;
        myGet.options['thread-timeout'] = settings['thread-timeout'];
        
        console.log(`[liveDownload] Batch ${this.batchNumber} using ${myGet.options['threads']} thread(s)`);

        await myGet.attach(fileHandle);
        
        // Add timeout wrapper - if batch takes > 10 minutes, something is wrong
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Batch download timeout after 10 minutes')), 600000)
        );
        
        await Promise.race([
          myGet.fetch(batchSegments),
          timeout
        ]);

        // Ensure writer is closed (MyGet should do this, but force it just in case)
        if (myGet.cache?.writer) {
          try {
            await myGet.cache.writer.close();
          } catch (e) {
            console.warn('[liveDownload] Writer already closed');
          }
        }

        console.log(`[liveDownload] Batch ${this.batchNumber} complete`);

      } catch (e) {
        console.error(`[liveDownload] Batch ${this.batchNumber} failed:`, e);
        
        // Don't throw - continue with other batches
        // Mark this batch as failed but don't stop entire recording
        this.showNotification(`Batch ${this.batchNumber} failed: ${e.message}. Continuing with remaining batches...`, 'warning');
      }
    }

    async stop() {
      this.active = false;
      
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      
      if (this.durationTimer) {
        clearInterval(this.durationTimer);
        this.durationTimer = null;
      }

      console.log('[liveDownload] Stopping...');
      
      // Hide UI
      this.hideUI();
      
      // Show finalizing message
      document.title = 'Finalizing recording...';

      // Download remaining segments
      if (this.pendingSegments.length > 0) {
        console.log(`[liveDownload] Final batch: ${this.pendingSegments.length} segments`);
        await this.downloadBatch();
      }

      // Concatenate
      document.title = 'Concatenating files...';
      await this.concatenateBatches();

      // Cleanup
      document.title = 'Cleaning up...';
      await this.cleanup();

      console.log('[liveDownload] Recording complete!');
      document.title = `✅ Complete: ${this.baseFilename}`;
      document.body.dataset.mode = 'done'; // Green background!
      this.showNotification(`Recording complete! ${this.totalSegments} segments saved to ${this.baseFilename}.ts`, 'success');
    }

    async concatenateBatches() {
      console.log(`[liveDownload] Concatenating ${this.batchFiles.length} batches...`);
      
      const writable = await this.finalFileHandle.createWritable();
      let successCount = 0;
      let skipCount = 0;

      for (const batch of this.batchFiles) {
        try {
          const file = await batch.handle.getFile();
          
          // Skip empty files (failed batches)
          if (file.size === 0) {
            console.warn(`[liveDownload] Skipping empty batch: ${batch.name}`);
            skipCount++;
            continue;
          }
          
          const buffer = await file.arrayBuffer();
          await writable.write(buffer);
          successCount++;
          console.log(`[liveDownload] Concatenated ${batch.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (e) {
          console.error(`[liveDownload] Failed to concatenate ${batch.name}:`, e);
          skipCount++;
        }
      }

      await writable.close();
      console.log(`[liveDownload] Concatenation complete: ${successCount} batches, ${skipCount} skipped`);
      
      if (skipCount > 0) {
        this.showNotification(`Note: ${skipCount} batch(es) were skipped due to errors. ${successCount} batches successfully concatenated.`, 'warning');
      }
    }

    /**
     * Show non-blocking toast notification
     */
    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.textContent = message;
      
      notification.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        max-width: 400px;
        padding: 12px 16px;
        background: ${type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10001;
        animation: slideInRight 0.3s ease-out;
      `;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    }

    async cleanup() {
      console.log('[liveDownload] Cleaning up...');
      
      try {
        for (const batch of this.batchFiles) {
          await this.componentDir.removeEntry(batch.name);
        }

        try {
          await this.directoryHandle.removeEntry(this.componentDir.name);
        } catch (e) {
          // Directory not empty is OK
        }

      } catch (e) {
        console.error('[liveDownload] Cleanup error:', e);
      }
    }
  }

  // Export to window for use by index.js
  window.LiveMonitor = LiveMonitor;
  window.LiveMonitor.isLiveStream = isLiveStream;

  console.log('[liveDownload] Ready');

})();
