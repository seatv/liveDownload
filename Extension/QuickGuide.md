# liveDownload Quick Guide

## Installation

1. Download the latest release or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `Extension` folder
6. Done! The extension icon should appear in your toolbar

## Quick Start

### Recording a Live Stream

1. Navigate to a page with a live HLS stream
2. Click the liveDownload extension icon
3. Look for streams with the **🔴 Record** button
4. Click **Record** to start capturing
5. A floating badge shows progress (segments, batches, duration)
6. Click **Stop Recording** when finished

### Downloading VOD Content

1. Navigate to a page with VOD content
2. Click the liveDownload extension icon
3. Look for streams with the **Download** button
4. Click **Download** to save the content
5. Choose your save location

### Batch Downloads

1. Check the boxes next to multiple streams
2. Click **Download Selected** (centered button)
3. Choose a directory once
4. All selected files download automatically

## First-Time Setup

### Configure Settings

Click the **⚙️ Settings** button to configure:

**Root Download Directory** (Recommended)
- Set once, use for all downloads
- No more repeated folder prompts
- Click "Select Root Directory" and choose a folder

**Batch Size** (Default: 20)
- Number of segments per batch file
- 20 is good for streams <1 hour
- Increase for longer streams (50-100)

**Live Recording Threads** (Keep at 1)
- Single-threaded prevents timestamp mangling
- **Important:** Don't change this for live streams

**Number of Threads** (Default: 3)
- For VOD downloads only
- 3 is optimal for most connections

**Filename Format** (Default: [title])
- Customize how files are named
- Available variables: [title], [meta.name], [timestamp]

## Common Tasks

### Change Filename Before Saving

When the save dialog appears, edit the filename as needed.

### Find Downloaded Files

Files are saved to:
- Your configured Root Directory (if set), or
- The location you chose in the save dialog

Live recordings create a folder with components:
```
StreamName.ts                    # Final merged file
StreamName_components/           # Batch files
  ├── StreamName_001.ts
  ├── StreamName_002.ts
  └── ...
```

### Stop a Recording

Click the **⬛ Stop Recording** button in the floating badge (top-right corner).

## Troubleshooting

**"No streams detected"**
- Refresh the page and try again
- Make sure the video is playing
- Try right-clicking the video player

**"Permission denied"**
- Check that the extension has permission for the site
- Try reloading the extension: `chrome://extensions/` → Reload button

**"Name is not allowed"**
- The filename contains illegal characters
- Manually edit the filename when saving

**Recording doesn't stop**
- Some servers don't send end markers
- Manually click "Stop Recording"

**Files won't play**
- Try a different media player (VLC recommended)
- Check that recording completed fully

## Keyboard Shortcuts

- **Alt + D** (or Ctrl + Option + D on Mac): Download Selected

## Tips & Best Practices

1. **Set Root Directory First** - Saves clicks on every download
2. **Use Batch Size 20** - Good default for most streams
3. **Single Thread for Live** - Prevents timestamp issues
4. **Test Short Recording First** - Before recording long streams
5. **Keep Components Folder** - Until you verify the merged file plays

## Support

- **Issues**: Open a GitHub issue with console logs
- **Feature Requests**: Tag with "enhancement"
- **Questions**: Check existing issues first

## Version

Current version: 0.3.4

Check `chrome://extensions/` for your installed version.
