# liveDownload

A modern Chrome extension for recording live HLS streams and downloading VOD content with a beautiful, intuitive interface.

## 🌟 Features

### Live Stream Recording
- **Continuous Recording**: Automatically captures live HLS/M3U8 streams as they broadcast
- **Batch Processing**: Downloads segments in configurable batches with automatic concatenation
- **Smart Detection**: Automatically distinguishes between live streams and VOD content
- **Reliable**: Single-threaded download mode prevents timestamp mangling
- **Resilient**: Continues recording even when individual segments fail
- **Long Recording Support**: Successfully tested on 100+ hour continuous streams

### Modern User Interface
- **Clean Design**: Beautiful blue gradient interface with modern styling
- **Scrollable Table**: Fixed-height table with smooth scrolling for large playlists
- **Live Detection**: Automatically shows "Record" button for live streams, "Download" for VOD
- **Recording Badge**: Floating status indicator showing segments, batches, and duration
- **Non-blocking Notifications**: Toast messages that never interrupt your workflow

### Flexible Configuration
- **Root Download Directory**: Set once, use everywhere - no repeated folder prompts
- **Batch Size**: Configurable from 10-1000 segments (default: 20)
- **Thread Control**: Separate settings for live recording (default: 1) and VOD downloads (default: 3)
- **Auto-Concatenation**: Optional automatic merge when stream ends
- **Persistent Settings**: All preferences saved via IndexedDB and chrome.storage

## 📥 Installation

### From Release Package
1. Download `liveDownload-v0.2.0.zip` from [Releases](../../releases)
2. Extract the archive
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top-right)
5. Click "Load unpacked"
6. Select the extracted `liveDownload-v0.2.0` folder

### From Source
```bash
git clone https://github.com/yourusername/liveDownload.git
cd liveDownload
```

Then follow steps 3-6 above, selecting the cloned directory.

## 🚀 Usage

### Recording a Live Stream
1. Navigate to a page with a live HLS stream
2. Click the liveDownload extension icon
3. Look for streams marked with the red "🔴 Record" button
4. Click "Record" to start capturing
5. A floating badge shows recording progress (segments, batches, duration)
6. Click "Stop Recording" when finished

### Downloading VOD Content
1. Navigate to a page with VOD content
2. Click the liveDownload extension icon
3. Look for streams marked with the blue "Download" button
4. Click "Download" to fetch the content
5. Files are saved to your configured root directory

### Configuration
1. Click the "⚙️ Settings" button in the extension window
2. Configure:
   - **Root Download Directory**: Choose where to save recordings
   - **Batch Size**: Number of segments per batch file (20 recommended for <1hr streams)
   - **Live Recording Threads**: Keep at 1 to prevent timestamp issues
   - **Number of Threads**: For VOD downloads (3 is optimal)
3. Click "Save Settings"

## 🛠️ Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background processing via `worker.js`
- **Modern UI**: Dynamic rendering with modern-ui.js
- **Batch Strategy**: Downloads segments in numbered batches (`stream_001.ts`, `stream_002.ts`, etc.)
- **File System API**: Native directory access via `showDirectoryPicker()`
- **IndexedDB**: Persistent storage for directory handles

### Live Stream Detection
The extension automatically detects stream type by analyzing M3U8 manifests:
- **Master playlists** (`#EXT-X-STREAM-INF`) → Download button
- **VOD playlists** (`#EXT-X-ENDLIST` or `#EXT-X-PLAYLIST-TYPE:VOD`) → Download button
- **Live playlists** (no end markers) → Record button

### File Organization
```
RootDirectory/
├── StreamName.ts                          # Final concatenated output
└── StreamName_YYYY-MM-DDTHH-MM-SS_components/
    ├── StreamName_001.ts                  # Batch 1
    ├── StreamName_002.ts                  # Batch 2
    └── StreamName_NNN.ts                  # Batch N
```

## 🐛 Known Issues

### Timestamp Mangling
Multi-threaded downloads can cause out-of-order segments. **Solution**: Set "Live Recording Threads" to 1 in settings.

### Missing ENDLIST Tags
Some servers don't send `#EXT-X-ENDLIST` when streams end. **Workaround**: Manually click "Stop Recording" when the stream finishes.

### Failed Segments
Network issues may cause individual segments to fail. The extension continues recording but may result in brief glitches in the final video.

## 📝 Changelog

### v0.2.0 (2025-12-29)
- ✨ Complete UI overhaul with modern blue gradient design
- ✨ Separate thread settings for live vs VOD downloads
- ✨ Improved live stream detection (handles master playlists)
- ✨ Non-blocking toast notifications
- ✨ Scrollable table with fixed headers
- ✨ Root directory persistence via IndexedDB
- 🐛 Fixed manifest V3 warnings
- 🐛 Fixed context menu duplicate errors
- 📦 Reduced default batch size to 20 segments
- 🔒 Removed analytics/tracking

### v0.1.0 - v0.1.9
- Initial development versions
- Batch download system implementation
- Live recording functionality
- Settings panel development

## 🙏 Credits

**Original Extension**: [Live Stream Downloader](https://github.com/chandler-stimson/live-stream-downloader) by [Chandler Stimson](https://github.com/chandler-stimson)

**liveDownload** is a fork that adds:
- Modern UI redesign
- Dedicated live stream recording features
- Enhanced batch download system
- Improved settings management
- Better UX for long-running recordings

## 📄 License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](LICENSE) file for details.

The original Live Stream Downloader is also licensed under MPL 2.0.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

If you encounter issues or have questions:
- Open an [Issue](../../issues) on GitHub
- Provide browser console logs when reporting bugs
- Include your Chrome version and OS

## ⚠️ Disclaimer

This extension is for personal use only. Ensure you have the right to download/record content before using this tool. Respect copyright laws and terms of service.
