# Sales Notification Chrome Extension

## **Overview**

The **Sales Notification Chrome Extension** is designed for *~300 Business Development Executives (BDEs)* at **Coding Ninjas** to receive **real-time notifications** about **sales activities**, **important announcements**, and **private messages**. The extension displays a **celebratory popup** with a *trophy animation* for sales, and simple notifications for other messages. It uses **WebSocket** for real-time updates and integrates with a backend API for user authentication via **OTP**.

### **Features**

- **Real-Time Notifications**:
  - **`sale_made`**: Displays a celebratory popup with a *trophy animation*, showing the BDE’s name, product sold, and manager’s name.
  - **`notification`**: Displays an important announcement.
  - **`private`**: Displays a private message for a specific user (based on email).
- **User Authentication**:
  - Authenticates users via **OTP** sent to their `@codingninjas.com` email.
  - Stores an authentication token securely in **Chrome storage**.
- **Settings UI**:
  - Authenticated users can access a *settings popup* (browser action dropdown).
  - Unauthenticated users see a *fullscreen authentication popup*.
- **Security**:
  - The API URL is **Base64-encoded** in the source code to reduce visibility.
  - Uses **token-based authentication** (UUID) for API and WebSocket communication, eliminating the need for a hardcoded API key in the extension.

## **Files**

| **File**         | **Description**                                      |
|------------------|------------------------------------------------------|
| `manifest.json`  | Defines the extension’s configuration, permissions, and entry points. |
| `background.js`  | Handles WebSocket connections, API requests, and popup triggering. |
| `popup.html` / `popup.js` | Displays notification popups with animations (e.g., trophy for sales). |
| `action.html` / `action.js` | Provides the settings UI for authenticated users and the authentication UI for unauthenticated users. |
| `icon48.png` / `icon128.png` | Extension icons. |

## **Setup Instructions**

### **Prerequisites**

- **Google Chrome** browser.
- A `@codingninjas.com` email address for authentication.
- The **backend service** must be deployed and running (see [Backend README](../backend/README.md)).

### **Installation**

1. **Clone or Download the Extension**:
   - Clone the repository or download the extension files to your local machine:
     ```bash
     git clone <repository-url>
     cd sales-notification-extension
     ```
2. **Load the Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** (top right toggle).
   - Click **Load unpacked** and select the folder containing the extension files.
3. **Authenticate**:
   - Click the extension icon in Chrome.
   - If unauthenticated, a *fullscreen popup* will prompt you to enter your `@codingninjas.com` email.
   - Request an **OTP**, check your email, and enter the OTP to authenticate.
   - Once authenticated, the settings UI will appear as a *dropdown popup* when clicking the icon.
4. **Receive Notifications**:
   - The extension will automatically connect to the backend via **WebSocket** and display popups for incoming notifications.

### **Environment Variables**

- **None** required in the extension itself. All sensitive values (e.g., API URL) are **Base64-encoded** in `background.js`, and authentication uses a token stored in `chrome.storage.local`.

## **Usage**

### **Authentication**

- On first use or after logging out, authenticate using your `@codingninjas.com` email and **OTP**.
- The authentication token is valid for **30 days** (`authExpiryDays` in `background.js`).

### **Notifications**

- **`sale_made`**: Shows a celebratory popup with a *trophy animation*, BDE name, product, and manager name.
- **`notification`**: Shows an important announcement in a highlighted box.
- **`private`**: Shows a private message if the email matches your authenticated email.

### **Settings**

- After authentication, click the extension icon to access the **settings UI**.
- You can **log out** from the settings UI, which clears the authentication token and prompts for re-authentication.

## **Security Notes**

- The API URL is **Base64-encoded** in `background.js` to reduce visibility, but it can be decoded by determined users. The backend is secured with **token-based authentication** to mitigate this risk.
- The `authToken` (UUID) is stored in `chrome.storage.local`, which is **secure** and only accessible to the extension.
- WebSocket connections and API requests (`/request-otp`, `/verify-otp`) are authenticated using the `authToken` sent as a **Bearer token** in the `Authorization` header or as a query parameter (`/ws?token=<token>`).

## **Limitations**

- The extension relies on a stable **WebSocket** connection to the backend. If the backend is down, notifications won’t be received until it’s back online.
- The API URL, while **Base64-encoded**, can be decoded. Backend security (token authentication, CORS, rate limiting) mitigates this risk.
