# Sales Notification Extension

## Project Overview
- **Stack**: Chrome Extension (Manifest V3), vanilla JavaScript, Chrome APIs (storage, alarms, system.display, activeTab)
- **Description**: Chrome extension for ~300 Coding Ninjas BDEs to receive real-time sales notifications via WebSocket. Displays celebratory popups with trophy animations for sales, general announcements, and private messages. Companion to `sales-notification-backend`.

## File Organization
- Never save working files to root folder
- `manifest.json` - Extension config (Manifest V3, permissions, service worker)
- `background.js` - Service worker: WebSocket connection, auth flow, popup management
- `popup.html` / `popup.js` - Notification display with animations and sound effects
- `action.html` / `action.js` - Auth UI (OTP flow) and settings panel
- `icon48.png` / `icon128.png` - Extension icons

## Key Architecture
- `ExtensionManager` class in `background.js` manages all state
- API URL is Base64-encoded in `background.js` (decodes to Render backend URL)
- Auth via OTP to `@codingninjas.com` emails, token stored in `chrome.storage.local`
- WebSocket reconnection with exponential backoff (max 5 attempts, 10s base delay)
- No build step required - plain JavaScript loaded directly by Chrome

## Build & Test
```bash
# No build step. Load unpacked in chrome://extensions/ with Developer mode enabled.
# To test: click extension icon, authenticate with OTP, verify WebSocket connection.
```

## Security Rules
- NEVER hardcode API keys, secrets, or credentials in any file
- NEVER pass credentials as inline env vars in Bash commands
- NEVER commit .env, .claude/settings.local.json, or .mcp.json to git
