let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseReconnectDelay = 5000;
const authExpiryDays = 30;
const processedMessages = new Set();
const FETCH_TIMEOUT = 30000; // 30 seconds
let authWindowId = null;
let lastPopupTime = 0;
const POPUP_COOLDOWN = 30000; // 30 seconds cooldown between popups
let pingTimer = null; // Timer for pinging

// Base64-encoded API URL components
const API_BASE_URL_ENCODED = 'aHR0cHM6Ly9zYWxlcy1ub3RpZmljYXRpb24tYmFja2VuZC5vbnJlbmRlci5jb20=';

// Decode Base64 URL at runtime
function getApiBaseUrl() {
  return atob(API_BASE_URL_ENCODED);
}

function getScreenDimensions(callback) {
  chrome.system.display.getInfo((displays) => {
    if (chrome.runtime.lastError) {
      console.error('Error fetching screen dimensions:', chrome.runtime.lastError);
      callback({ width: 1920, height: 1080 });
      return;
    }
    const primaryDisplay = displays.find(display => display.isPrimary) || displays[0];
    const width = primaryDisplay ? primaryDisplay.bounds.width : 1920;
    const height = primaryDisplay ? primaryDisplay.bounds.height : 1080;
    console.log('Screen dimensions:', { width, height });
    callback({ width, height });
  });
}

function checkAuthentication(callback) {
  chrome.storage.local.get(['authToken', 'authTimestamp'], (result) => {
    const token = result.authToken;
    const timestamp = result.authTimestamp;
    const now = Date.now();
    const expiry = 1000 * 60 * 60 * 24 * authExpiryDays;
    const isAuthenticated = token && timestamp && (now - timestamp) < expiry;
    console.log('Authentication check:', { isAuthenticated, token, timestamp });
    callback(isAuthenticated);
  });
}

function setAuthentication(token, email, callback) {
  chrome.storage.local.set({
    authToken: token,
    authTimestamp: Date.now(),
    userEmail: email,
    wsConnectionActive: false // Reset connection flag on new authentication
  }, () => {
    console.log('Authentication set for:', { token, email });
    callback(true);
    if (authWindowId !== null) {
      chrome.windows.remove(authWindowId, () => {
        authWindowId = null;
      });
    }
  });
}

function clearAuthentication(callback) {
  chrome.storage.local.remove(['authToken', 'authTimestamp', 'userEmail', 'wsConnectionActive'], () => {
    console.log('Authentication cleared');
    callback();
    if (pingTimer) {
      clearTimeout(pingTimer);
      pingTimer = null;
    }
  });
}

function showAuthPopup() {
  if (authWindowId !== null) {
    chrome.windows.get(authWindowId, (window) => {
      if (!chrome.runtime.lastError && window) {
        chrome.windows.update(authWindowId, { focused: true });
      } else {
        getScreenDimensions((dimensions) => {
          chrome.windows.create({
            url: chrome.runtime.getURL('action.html'),
            type: 'popup',
            width: dimensions.width,
            height: dimensions.height,
            focused: true,
            left: 0,
            top: 0
          }, (window) => {
            authWindowId = window.id;
          });
        });
      }
    });
  } else {
    getScreenDimensions((dimensions) => {
      chrome.windows.create({
        url: chrome.runtime.getURL('action.html'),
        type: 'popup',
        width: dimensions.width,
        height: dimensions.height,
        focused: true,
        left: 0,
        top: 0
      }, (window) => {
        authWindowId = window.id;
      });
    });
  }
}

function connectWebSocket() {
  checkAuthentication((isAuthenticated) => {
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

      if (wsConnectionActive) {
        console.log('WebSocket connection already active for this token. Skipping connection attempt.');
        return;
      }

      const apiBaseUrl = getApiBaseUrl();
      console.log('Attempting to connect WebSocket...');
      ws = new WebSocket(`wss://${apiBaseUrl.replace('https://', '')}/ws?token=${token}`);

      // Set the connection active flag
      chrome.storage.local.set({ wsConnectionActive: true }, () => {
        console.log('Set wsConnectionActive to true');
      });

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        reconnectAttempts = 0;
        startPing();
        requestNextNotification();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        if (data.type === 'pong') {
          console.log('Received pong from server');
        } else if (data.type === 'wait') {
          const remaining = data.remaining;
          console.log(`Server in cooldown, waiting ${remaining}ms before requesting next notification`);
          setTimeout(requestNextNotification, remaining);
        } else if (data.type === 'noNotifications') {
          console.log('No more notifications in queue');
        } else {
          if (data.messageId && processedMessages.has(data.messageId)) {
            console.log('Duplicate message ignored:', data.messageId);
            return;
          }
          if (data.messageId) {
            processedMessages.add(data.messageId);
            if (processedMessages.size > 1000) {
              const iterator = processedMessages.entries();
              for (let i = 0; i < 500; i++) {
                iterator.next().value && processedMessages.delete(iterator.next().value[0]);
              }
            }
          }
          if (data.type === 'private') {
            chrome.storage.local.get(['userEmail'], (result) => {
              const userEmail = result.userEmail;
              if (data.email === userEmail) {
                showPopup(data);
              } else {
                console.log('Private message ignored: email mismatch', { messageEmail: data.email, userEmail });
              }
            });
          } else {
            showPopup(data);
          }
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected with code:', event.code);
        // Clear the connection active flag
        chrome.storage.local.set({ wsConnectionActive: false }, () => {
          console.log('Set wsConnectionActive to false');
        });

        // Stop the ping timer
        if (pingTimer) {
          clearTimeout(pingTimer);
          pingTimer = null;
        }

        // Avoid reconnecting if the server rejected the connection due to rate limiting
        if (event.code === 1008) { // 1008: Connection attempt too soon or too many connections
          console.log('Connection rejected by server (rate limit or too many connections). Not retrying immediately.');
          setTimeout(connectWebSocket, baseReconnectDelay); // Wait before retrying
          return;
        }

        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts) + Math.random() * 100;
          console.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${reconnectAttempts + 1})`);
          setTimeout(connectWebSocket, delay);
          reconnectAttempts++;
        } else {
          console.error('Max reconnect attempts reached. Please reload the extension.');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };
    });
  });
}

function startPing() {
  // Stop any existing ping timer
  if (pingTimer) {
    clearTimeout(pingTimer);
    pingTimer = null;
  }

  // Start a new ping cycle
  pingTimer = setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
    startPing(); // Schedule the next ping
  }, 30000); // Ping every 30 seconds
}

function requestNextNotification() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'requestNextNotification' }));
    console.log('Requested next notification from server');
  }
}

function showPopup(data) {
  console.log('Checking to show popup for data:', data);

  chrome.storage.local.get(['popupsEnabled'], (result) => {
    const popupsEnabled = result.popupsEnabled !== undefined ? result.popupsEnabled : true;
    if (!popupsEnabled) {
      console.log('Popups are disabled by user. Skipping popup.');
      setTimeout(requestNextNotification, POPUP_COOLDOWN);
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

    getScreenDimensions((dimensions) => {
      chrome.storage.local.get(['popupSize'], (result) => {
        let isFullWindow = true;
        if (result.popupSize) {
          isFullWindow = result.popupSize === 'full';
        } else {
          chrome.storage.local.set({ popupSize: 'full' });
        }
        chrome.windows.create({
          url: chrome.runtime.getURL(url),
          type: 'popup',
          width: isFullWindow ? dimensions.width : 400,
          height: isFullWindow ? dimensions.height : 300,
          focused: true,
          left: isFullWindow ? 0 : undefined,
          top: isFullWindow ? 0 : undefined
        }, () => {
          lastPopupTime = Date.now();
          console.log('Popup shown at:', new Date(lastPopupTime).toISOString());
          setTimeout(requestNextNotification, POPUP_COOLDOWN);
        });
      });
    });
  });
}

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  checkAuthentication((isAuthenticated) => {
    if (!isAuthenticated) {
      chrome.action.setPopup({ popup: '' }, () => {
        showAuthPopup();
      });
    } else {
      chrome.action.setPopup({ popup: 'action.html' });
    }
  });
});

// On extension install or startup
chrome.runtime.onInstalled.addListener(() => {
  checkAuthentication((isAuthenticated) => {
    if (!isAuthenticated) {
      showAuthPopup();
    }
  });
  chrome.alarms.create('authPrompt', { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.clear('authPrompt', () => {
    chrome.alarms.create('authPrompt', { periodInMinutes: 60 });
  });
  checkAuthentication((isAuthenticated) => {
    if (!isAuthenticated) {
      showAuthPopup();
    }
  });
});

// Handle periodic auth prompt
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'authPrompt') {
    console.log('Auth prompt alarm triggered');
    checkAuthentication((isAuthenticated) => {
      if (!isAuthenticated) {
        showAuthPopup();
      }
    });
  } else if (alarm.name === 'keepAlive') {
    console.log('Alarm triggered: Keeping service worker alive');
    checkAuthentication((isAuthenticated) => {
      if (isAuthenticated && (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
        console.log('WebSocket not connected. Reconnecting...');
        connectWebSocket();
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    checkAuthentication((isAuthenticated) => {
      sendResponse({ isAuthenticated });
    });
    return true;
  } else if (request.action === 'requestOTP') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const apiBaseUrl = getApiBaseUrl();

    chrome.storage.local.get(['authToken'], (result) => {
      const token = result.authToken;
      console.log('RequestOTP - authToken:', token);
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${apiBaseUrl}/request-otp`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ email: request.email }),
        signal: controller.signal
      })
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}, StatusText: ${response.statusText}`);
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
    return true;
  } else if (request.action === 'verifyOTP') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const apiBaseUrl = getApiBaseUrl();

    chrome.storage.local.remove(['authToken'], () => {
      console.log('Cleared authToken before verifyOTP request');
      chrome.storage.local.get(['authToken'], (result) => {
        const token = result.authToken;
        console.log('VerifyOTP - authToken:', token);
        const headers = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        fetch(`${apiBaseUrl}/verify-otp`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ email: request.email, otp: request.otp }),
          signal: controller.signal
        })
          .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}, StatusText: ${response.statusText}`);
            }
            return response.json();
          })
          .then(data => {
            if (data.message === 'OTP verified successfully') {
              setAuthentication(data.token, data.email, () => {
                sendResponse({ isAuthenticated: true });
                connectWebSocket();
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
    });
    return true;
  } else if (request.action === 'setPopupSize') {
    chrome.storage.local.set({ popupSize: request.size }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'getPopupSize') {
    chrome.storage.local.get(['popupSize'], (result) => {
      sendResponse({ size: result.popupSize || 'full' });
    });
    return true;
  } else if (request.action === 'showPopup') {
    showPopup(request.data);
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'logout') {
    clearAuthentication(() => {
      sendResponse({ success: true });
      if (sender.tab && sender.tab.windowId) {
        chrome.windows.remove(sender.tab.windowId);
      }
      showAuthPopup();
    });
    return true;
  }
});

chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });

connectWebSocket();
