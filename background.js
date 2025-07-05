// Enhanced background service worker with better memory management
class ExtensionManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 5000;
    this.authExpiryDays = 30;
    this.processedMessages = new Set();
    this.FETCH_TIMEOUT = 30000;
    this.authWindowId = null;
    this.lastPopupTime = 0;
    this.POPUP_COOLDOWN = 30000;
    this.pingTimer = null;
    this.keepAliveTimer = null;
    this.connectionRetryTimer = null;
    
    // Initialize
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupKeepAlive();
    this.checkInitialAuth();
  }

  // Base64-encoded API URL
  getApiBaseUrl() {
    return atob('aHR0cHM6Ly9zYWxlcy1ub3RpZmljYXRpb24tYmFja2VuZC5vbnJlbmRlci5jb20=');
  }

  setupEventListeners() {
    // Extension icon click
    chrome.action.onClicked.addListener(() => {
      this.handleActionClick();
    });

    // Extension install/startup
    chrome.runtime.onInstalled.addListener(() => {
      this.handleInstall();
    });

    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    // Handle messages from popup/content
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this.handleMessage(request, sender, sendResponse);
    });

    // Handle alarms
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });
  }

  setupKeepAlive() {
    // Keep service worker alive
    chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
    chrome.alarms.create('authPrompt', { periodInMinutes: 60 });
    
    // Set up periodic connection check
    this.keepAliveTimer = setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  checkConnection() {
    this.checkAuthentication((isAuthenticated) => {
      if (isAuthenticated) {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
          console.log('WebSocket not connected. Reconnecting...');
          this.connectWebSocket();
        } else if (this.ws.readyState === WebSocket.OPEN) {
          // Send keep-alive
          this.ws.send(JSON.stringify({ type: 'keepAlive' }));
        }
      }
    });
  }

  checkInitialAuth() {
    this.checkAuthentication((isAuthenticated) => {
      if (!isAuthenticated) {
        this.showAuthPopup();
      } else {
        this.connectWebSocket();
      }
    });
  }

  handleActionClick() {
    this.checkAuthentication((isAuthenticated) => {
      if (!isAuthenticated) {
        chrome.action.setPopup({ popup: '' }, () => {
          this.showAuthPopup();
        });
      } else {
        chrome.action.setPopup({ popup: 'action.html' });
      }
    });
  }

  handleInstall() {
    this.checkAuthentication((isAuthenticated) => {
      if (!isAuthenticated) {
        this.showAuthPopup();
      }
    });
  }

  handleStartup() {
    this.checkAuthentication((isAuthenticated) => {
      if (!isAuthenticated) {
        this.showAuthPopup();
      } else {
        this.connectWebSocket();
      }
    });
  }

  handleAlarm(alarm) {
    if (alarm.name === 'authPrompt') {
      console.log('Auth prompt alarm triggered');
      this.checkAuthentication((isAuthenticated) => {
        if (!isAuthenticated) {
          this.showAuthPopup();
        }
      });
    } else if (alarm.name === 'keepAlive') {
      console.log('Keep alive alarm triggered');
      this.checkConnection();
    }
  }

  handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'checkAuth':
          this.checkAuthentication((isAuthenticated) => {
            sendResponse({ isAuthenticated });
          });
          return true;

        case 'requestOTP':
          this.requestOTP(request.email, sendResponse);
          return true;

        case 'verifyOTP':
          this.verifyOTP(request.email, request.otp, sendResponse);
          return true;

        case 'setPopupSize':
          this.setPopupSize(request.size, sendResponse);
          return true;

        case 'getPopupSize':
          this.getPopupSize(sendResponse);
          return true;

                case 'showPopup':
          this.showPopup(request.data);
          sendResponse({ success: true });
          return true;

        case 'logout':
          this.logout(sendResponse, sender);
          return true;

        case 'updatePopupSettings':
          this.updatePopupSettings(request.popupsEnabled, sendResponse);
          return true;

        default:
          sendResponse({ error: 'Unknown action' });
          return true;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: 'Internal error' });
      return true;
    }
  }

  getScreenDimensions(callback) {
    chrome.system.display.getInfo((displays) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching screen dimensions:', chrome.runtime.lastError);
        callback({ width: 1920, height: 1080 });
        return;
      }
      const primaryDisplay = displays.find(display => display.isPrimary) || displays[0];
      const width = primaryDisplay ? primaryDisplay.bounds.width : 1920;
      const height = primaryDisplay ? primaryDisplay.bounds.height : 1080;
      callback({ width, height });
    });
  }

  checkAuthentication(callback) {
    chrome.storage.local.get(['authToken', 'authTimestamp'], (result) => {
      const token = result.authToken;
      const timestamp = result.authTimestamp;
      const now = Date.now();
      const expiry = 1000 * 60 * 60 * 24 * this.authExpiryDays;
      const isAuthenticated = token && timestamp && (now - timestamp) < expiry;
      callback(isAuthenticated);
    });
  }

  setAuthentication(token, email, callback) {
    chrome.storage.local.set({
      authToken: token,
      authTimestamp: Date.now(),
      userEmail: email,
      wsConnectionActive: false,
      popupsEnabled: true // Default to enabled
    }, () => {
      console.log('Authentication set for:', email);
      callback(true);
      if (this.authWindowId !== null) {
        chrome.windows.remove(this.authWindowId, () => {
          this.authWindowId = null;
        });
      }
    });
  }

  clearAuthentication(callback) {
    chrome.storage.local.remove(['authToken', 'authTimestamp', 'userEmail', 'wsConnectionActive'], () => {
      console.log('Authentication cleared');
      callback();
      if (this.pingTimer) {
        clearTimeout(this.pingTimer);
        this.pingTimer = null;
      }
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    });
  }

  showAuthPopup() {
    if (this.authWindowId !== null) {
      chrome.windows.get(this.authWindowId, (window) => {
        if (!chrome.runtime.lastError && window) {
          chrome.windows.update(this.authWindowId, { focused: true });
        } else {
          this.createAuthWindow();
        }
      });
    } else {
      this.createAuthWindow();
    }
  }

  createAuthWindow() {
    this.getScreenDimensions((dimensions) => {
      chrome.windows.create({
        url: chrome.runtime.getURL('action.html'),
        type: 'popup',
        width: Math.min(400, dimensions.width),
        height: Math.min(600, dimensions.height),
        focused: true,
        left: Math.floor((dimensions.width - 400) / 2),
        top: Math.floor((dimensions.height - 600) / 2)
      }, (window) => {
        this.authWindowId = window.id;
      });
    });
  }

  connectWebSocket() {
    this.checkAuthentication((isAuthenticated) => {
      if (!isAuthenticated) {
        console.log('Not authenticated. Skipping WebSocket connection.');
        return;
      }

      chrome.storage.local.get(['authToken', 'wsConnectionActive'], (result) => {
        const token = result.authToken;
        const wsConnectionActive = result.wsConnectionActive || false;

        if (!token) {
          console.log('No auth token available for WebSocket connection.');
          return;
        }

        if (wsConnectionActive && this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('WebSocket already connected and active.');
          return;
        }

        const apiBaseUrl = this.getApiBaseUrl();
        console.log('Attempting to connect WebSocket...');

        try {
          this.ws = new WebSocket(`wss://${apiBaseUrl.replace('https://', '')}/ws?token=${token}`);
          
          chrome.storage.local.set({ wsConnectionActive: true });

          this.ws.onopen = () => {
            console.log('WebSocket connected successfully');
            this.reconnectAttempts = 0;
            this.startPing();
            this.requestNextNotification();
          };

          this.ws.onmessage = (event) => {
            this.handleWebSocketMessage(event);
          };

          this.ws.onclose = (event) => {
            this.handleWebSocketClose(event);
          };

          this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.ws.close();
          };

        } catch (error) {
          console.error('Failed to create WebSocket:', error);
          chrome.storage.local.set({ wsConnectionActive: false });
        }
      });
    });
  }

  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data.type);

      switch (data.type) {
        case 'pong':
          console.log('Received pong from server');
          break;

        case 'keepAliveResponse':
          console.log('Received keep-alive response');
          break;

        case 'wait':
          const remaining = data.remaining;
          console.log(`Server in cooldown, waiting ${remaining}ms`);
          setTimeout(() => this.requestNextNotification(), remaining);
          break;

        case 'noNotifications':
          console.log('No more notifications in queue');
          break;

        default:
          this.processNotification(data);
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  processNotification(data) {
    // Check for duplicate messages
    if (data.messageId && this.processedMessages.has(data.messageId)) {
      console.log('Duplicate message ignored:', data.messageId);
      return;
    }

    if (data.messageId) {
      this.processedMessages.add(data.messageId);
      // Keep only last 1000 messages to prevent memory leak
      if (this.processedMessages.size > 1000) {
        const iterator = this.processedMessages.entries();
        for (let i = 0; i < 500; i++) {
          const entry = iterator.next();
          if (entry.done) break;
          this.processedMessages.delete(entry.value[0]);
        }
      }
    }

    // Handle different notification types
    if (data.type === 'private') {
      chrome.storage.local.get(['userEmail'], (result) => {
        const userEmail = result.userEmail;
        if (data.email === userEmail) {
          this.showPopup(data);
        } else {
          console.log('Private message ignored: email mismatch');
        }
      });
    } else {
      this.showPopup(data);
    }
  }

  handleWebSocketClose(event) {
    console.log('WebSocket disconnected with code:', event.code);
    
    chrome.storage.local.set({ wsConnectionActive: false });

    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }

    // Handle different close codes
    if (event.code === 1008) {
      console.log('Connection rejected by server. Retrying in 30 seconds...');
      this.connectionRetryTimer = setTimeout(() => this.connectWebSocket(), 30000);
      return;
    }

    // Exponential backoff for reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
        300000 // Max 5 minutes
      ) + Math.random() * 1000;
      
      console.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${this.reconnectAttempts + 1})`);
      
      this.connectionRetryTimer = setTimeout(() => this.connectWebSocket(), delay);
      this.reconnectAttempts++;
    } else {
      console.error('Max reconnect attempts reached. Will retry on next keep-alive.');
      this.reconnectAttempts = 0; // Reset for next keep-alive attempt
    }
  }

  startPing() {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }

    this.pingTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
      this.startPing();
    }, 30000);
  }

  requestNextNotification() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'requestNextNotification' }));
      console.log('Requested next notification from server');
    }
  }

  showPopup(data) {
    console.log('Checking to show popup for data:', data.type);

    chrome.storage.local.get(['popupsEnabled'], (result) => {
      const popupsEnabled = result.popupsEnabled !== undefined ? result.popupsEnabled : true;
      
      if (!popupsEnabled) {
        console.log('Popups are disabled by user. Skipping popup.');
        setTimeout(() => this.requestNextNotification(), this.POPUP_COOLDOWN);
        return;
      }

      let url;
      if (data.type === 'sale_made') {
        const { bdeName, product, managerName } = data;
        url = `popup.html?type=sale_made&bdeName=${encodeURIComponent(bdeName)}&product=${encodeURIComponent(product)}&managerName=${encodeURIComponent(managerName)}`;
      } else if (data.type === 'notification') {
        const { message } = data;
        url = `popup.html?type=notification&message=${encodeURIComponent(message)}`;
      } else if (data.type === 'private') {
        const { message } = data;
        url = `popup.html?type=private&message=${encodeURIComponent(message)}`;
      } else {
        console.error('Unknown payload type:', data.type);
        return;
      }

      this.getScreenDimensions((dimensions) => {
        chrome.storage.local.get(['popupSize'], (result) => {
          let isFullWindow = result.popupSize === 'full';
          if (!result.popupSize) {
            isFullWindow = true;
            chrome.storage.local.set({ popupSize: 'full' });
          }

          const popupWidth = isFullWindow ? dimensions.width : 400;
          const popupHeight = isFullWindow ? dimensions.height : 300;

          chrome.windows.create({
            url: chrome.runtime.getURL(url),
            type: 'popup',
            width: popupWidth,
            height: popupHeight,
            focused: true,
            left: isFullWindow ? 0 : Math.floor((dimensions.width - popupWidth) / 2),
            top: isFullWindow ? 0 : Math.floor((dimensions.height - popupHeight) / 2)
          }, (window) => {
            this.lastPopupTime = Date.now();
            console.log('Popup shown at:', new Date(this.lastPopupTime).toISOString());
            setTimeout(() => this.requestNextNotification(), this.POPUP_COOLDOWN);
          });
        });
      });
    });
  }

  // API Methods
  requestOTP(email, sendResponse) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);
    const apiBaseUrl = this.getApiBaseUrl();

    chrome.storage.local.get(['authToken'], (result) => {
      const token = result.authToken;
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${apiBaseUrl}/request-otp`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ email: email }),
        signal: controller.signal
      })
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          sendResponse(data);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          console.error('Fetch error for requestOTP:', error.message);
          if (error.name === 'AbortError') {
            sendResponse({ error: 'Request timed out. Please try again.' });
          } else {
            sendResponse({ error: error.message || 'Failed to request OTP' });
          }
        });
    });
  }

  verifyOTP(email, otp, sendResponse) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);
    const apiBaseUrl = this.getApiBaseUrl();

    chrome.storage.local.remove(['authToken'], () => {
      const headers = {
        'Content-Type': 'application/json'
      };

      fetch(`${apiBaseUrl}/verify-otp`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ email: email, otp: otp }),
        signal: controller.signal
      })
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.message === 'OTP verified successfully') {
            this.setAuthentication(data.token, data.email, () => {
              sendResponse({ isAuthenticated: true });
              this.connectWebSocket();
            });
          } else {
            sendResponse({ error: data.error });
          }
        })
        .catch(error => {
          clearTimeout(timeoutId);
          console.error('Fetch error for verifyOTP:', error.message);
          if (error.name === 'AbortError') {
            sendResponse({ error: 'Request timed out. Please try again.' });
          } else {
            sendResponse({ error: error.message || 'Failed to verify OTP' });
          }
        });
    });
  }

  setPopupSize(size, sendResponse) {
    chrome.storage.local.set({ popupSize: size }, () => {
      sendResponse({ success: true });
    });
  }

  getPopupSize(sendResponse) {
    chrome.storage.local.get(['popupSize'], (result) => {
      sendResponse({ size: result.popupSize || 'full' });
    });
  }

  updatePopupSettings(popupsEnabled, sendResponse) {
    chrome.storage.local.set({ popupsEnabled: popupsEnabled }, () => {
      // Also update the server connection
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'updatePopupSettings',
          popupsEnabled: popupsEnabled
        }));
      }
      sendResponse({ success: true });
    });
  }

  logout(sendResponse, sender) {
    this.clearAuthentication(() => {
      sendResponse({ success: true });
      if (sender.tab && sender.tab.windowId) {
        chrome.windows.remove(sender.tab.windowId);
      }
      this.showAuthPopup();
    });
  }

  // Cleanup method
  cleanup() {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
        if (this.connectionRetryTimer) {
      clearTimeout(this.connectionRetryTimer);
      this.connectionRetryTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.processedMessages.clear();
  }
}

// Initialize the extension manager
const extensionManager = new ExtensionManager();

// Handle service worker termination
self.addEventListener('beforeunload', () => {
  extensionManager.cleanup();
});
