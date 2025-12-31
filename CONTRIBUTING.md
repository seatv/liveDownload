# Contributing to liveDownload

Thank you for your interest in contributing to liveDownload! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and constructive
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title**: Descriptive summary of the issue
- **Steps to reproduce**: Detailed steps to recreate the bug
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Environment**:
  - Chrome version
  - Operating system
  - Extension version
- **Console logs**: Open DevTools → Console, copy any errors
- **Screenshots**: If applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear title**: Describe the enhancement
- **Provide detailed description**: Explain why this enhancement would be useful
- **Describe alternatives**: What alternatives have you considered?
- **Additional context**: Add any other context or screenshots

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes**:
   - Follow the existing code style
   - Add comments for complex logic
   - Test your changes thoroughly
3. **Update documentation**:
   - Update README.md if needed
   - Update CHANGELOG.md with your changes
4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Reference issue numbers when applicable
5. **Push to your fork** and submit a pull request

#### Pull Request Guidelines

- **One feature per PR**: Keep pull requests focused
- **Test thoroughly**: Ensure your changes work
- **Describe your changes**: Explain what and why
- **Link related issues**: Reference relevant issue numbers

## Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/liveDownload.git
cd liveDownload

# Load in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the liveDownload directory
```

## Project Structure

```
liveDownload/
├── manifest.json           # Extension manifest (v3)
├── worker.js              # Service worker (background)
├── context.js             # Context menu handlers
├── data/
│   ├── icons/            # Extension icons
│   └── job/
│       ├── index.html    # Main UI
│       ├── index.js      # Core download logic
│       ├── settings.js   # Settings management
│       ├── settings.css  # Settings styling
│       ├── modern-ui.js  # Modern UI renderer
│       ├── modern-ui.css # Modern UI styling
│       └── live-integration.js # Live recording logic
├── network/
│   ├── core.js           # Network utilities
│   └── icon.js           # Badge/icon management
└── plugins/
    └── blob-detector/    # Media detection
```

## Coding Guidelines

### JavaScript

- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Use template literals for string interpolation
- Add JSDoc comments for functions
- Handle errors gracefully with try-catch

Example:
```javascript
/**
 * Checks if a stream is live or VOD
 * @param {string} url - M3U8 manifest URL
 * @returns {Promise<boolean>} True if live, false if VOD
 */
async function isLiveStream(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    return !text.includes('#EXT-X-ENDLIST');
  } catch (e) {
    console.error('Stream check failed:', e);
    return false;
  }
}
```

### CSS

- Use modern CSS (flexbox, grid)
- Follow existing naming conventions
- Group related properties
- Use CSS variables for colors
- Mobile-first approach when applicable

### Commit Messages

Format: `<type>: <subject>`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat: Add batch size validation
fix: Prevent timestamp mangling with single thread
docs: Update installation instructions
style: Format settings.js with consistent spacing
refactor: Extract live detection to separate module
```

## Testing

Before submitting a PR:

1. **Test basic functionality**:
   - Load extension in Chrome
   - Open extension on a page with streams
   - Verify streams detected correctly
   - Test Download button (VOD)
   - Test Record button (LIVE)

2. **Test settings**:
   - Open settings panel
   - Change each setting
   - Verify persistence (reload extension)

3. **Test edge cases**:
   - Very long streams (>10 hours)
   - Network failures
   - Empty playlists
   - Master vs media playlists

4. **Check console for errors**:
   - No errors in DevTools console
   - No warnings (except expected ones)

## Architecture Notes

### Live Recording Flow

1. User clicks "Record" button
2. `live-integration.js` creates LiveMonitor instance
3. Monitor polls M3U8 every few seconds
4. New segments detected via deduplication
5. Segments downloaded in batches
6. Each batch saved as numbered file
7. On stop, all batches concatenated

### Settings Storage

- **chrome.storage.local**: User preferences (batch size, threads, etc.)
- **IndexedDB**: FileSystemDirectoryHandle (can't be serialized to chrome.storage)

### UI Rendering

1. Original extension creates entries in `#hrefs`
2. `modern-ui.js` intercepts via MutationObserver
3. Entries hidden, data extracted
4. Modern table rendered dynamically
5. Click handlers delegate to original buttons

## Questions?

- Open an issue for questions
- Tag with `question` label
- We're here to help!

## License

By contributing, you agree that your contributions will be licensed under the Mozilla Public License 2.0.
