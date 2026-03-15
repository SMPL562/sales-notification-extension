# Environments - Sales Notification Extension

**Repo**: SMPL562/sales-notification-extension
**Stack**: Chrome Extension (Manifest V3), vanilla JavaScript, Chrome APIs

---

## Local Development

### Prerequisites

- Google Chrome browser
- A `@codingninjas.com` email address for authentication
- The [sales-notification-backend](https://github.com/SMPL562/sales-notification-backend) must be running

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SMPL562/sales-notification-extension.git
   cd sales-notification-extension
   ```

2. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top right)
   - Click **Load unpacked**
   - Select the repository root folder

3. Authenticate:
   - Click the extension icon in the Chrome toolbar
   - Enter your `@codingninjas.com` email
   - Request and enter the OTP from your email
   - Once authenticated, the settings UI replaces the auth popup

### No Build Step Required

This is a plain JavaScript extension -- no bundler, transpiler, or npm install needed. Chrome loads the files directly from the folder.

### manifest.json Key Settings

| Field | Value |
|-------|-------|
| `manifest_version` | 3 |
| `version` | 1.0.4 |
| `service_worker` | `background.js` |
| `permissions` | `storage`, `alarms`, `system.display`, `activeTab` |
| `host_permissions` | `https://sales-notification-backend.onrender.com/*` |
| `content_security_policy` | `script-src 'self'; object-src 'self'` |

### File Map

| File | Purpose |
|------|---------|
| `background.js` | Service worker: WebSocket connection, auth flow, popup management |
| `popup.html` / `popup.js` | Notification display with trophy animations |
| `action.html` / `action.js` | Auth UI (OTP flow) and settings panel |
| `manifest.json` | Extension configuration |
| `icon48.png` / `icon128.png` | Extension icons |

---

## Environment Variables

**None required.** The extension has no `.env` file or build-time environment variables.

- The backend API URL is Base64-encoded in `background.js`
- Authentication tokens are stored in `chrome.storage.local`
- All configuration lives in `manifest.json`

---

## Production / Deployment

**Current status**: Deployed as an unpacked extension distributed internally to ~300 Coding Ninjas BDEs.

There is no Chrome Web Store listing. Distribution is handled by sharing the extension folder and having users load it unpacked.

The backend dependency is hosted on Render at `sales-notification-backend.onrender.com`.

---

## CI/CD

**Pipeline**: GitHub Actions on `ubuntu-latest`
**Triggers**: Push/PR to `main` or `master` (ignores `*.md`, `docs/**`, `.claude/**`, `.vscode/**`)

| Step | Description |
|------|-------------|
| Manifest Validation | Validates `manifest.json` is MV3 with required fields and referenced files exist |
| JS Syntax Check | Runs `node --check` on all `*.js` files |
| CI Summary | Outputs results to GitHub Step Summary |

---

## Troubleshooting

**Extension not loading**
- Ensure Developer mode is enabled in `chrome://extensions/`
- Check that all files (`background.js`, `popup.html`, etc.) are present in the folder
- Look for errors on the extension card in `chrome://extensions/`

**WebSocket not connecting**
- Verify the backend is running at `sales-notification-backend.onrender.com`
- Check the service worker console: `chrome://extensions/` > extension > "Inspect views: service worker"
- WebSocket reconnection uses exponential backoff (max 5 attempts, 10s base delay)

**Auth token expired**
- Tokens are valid for 30 days (`authExpiryDays` in `background.js`)
- Log out from the settings UI and re-authenticate with a new OTP

**Notifications not appearing**
- Confirm the WebSocket connection is active (check service worker console)
- Verify you are authenticated (click extension icon -- you should see settings, not the auth form)
- Private messages only appear if your email matches the target email
