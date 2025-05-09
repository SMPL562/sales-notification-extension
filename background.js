let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseReconnectDelay = 5000;
const authExpiryDays = 30;
const processedMessages = new Set();

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

function setAuthentication(token, callback) {
  chrome.storage.local.set({
    authToken: token,
    authTimestamp: Date.now()
  }, () => {
    console.log('Authentication set for:', token);
    callback(true);
  });
}

function connectWebSocket() {
  checkAuthentication((isAuthenticated) => {
    if (!isAuthenticated) {
      console.log('Not authenticated. Skipping WebSocket connection.');
      return;
    }

    console.log('Attempting to connect WebSocket...');
    ws = new WebSocket('wss://sales-notification-backend.onrender.com/ws');

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      reconnectAttempts = 0;
      sendPing();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      if (data.type === 'pong') {
        console.log('Received pong from server');
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
        showPopup(data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
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
}

function sendPing() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
  setTimeout(sendPing, 30000);
}

function showPopup(data) {
  checkAuthentication((isAuthenticated) => {
    if (!isAuthenticated) {
      console.log('Not authenticated. Skipping popup.');
      return;
    }

    console.log('Showing popup for data:', data);
    let url;
    if (data.type === 'sale_made') {
      const { bdeName, product, managerName } = data;
      url = `popup.html?type=sale_made&bdeName=${encodeURIComponent(bdeName)}&product=${encodeURIComponent(product)}&managerName=${encodeURIComponent(managerName)}`;
    } else if (data.type === 'notification') {
      const { message } = data;
      url = `popup.html?type=notification&message=${encodeURIComponent(message)}`;
    } else {
      console.error('Unknown payload type:', data.type);
      return;
    }

    // Check popup size preference
    chrome.storage.local.get(['popupSize'], (result) => {
      const isFullWindow = result.popupSize === 'full';
      chrome.windows.create({
        url: chrome.runtime.getURL(url),
        type: 'popup',
        width: isFullWindow ? window.screen.width : 400,
        height: isFullWindow ? window.screen.height : 300,
        focused: true,
        left: isFullWindow ? 0 : undefined,
        top: isFullWindow ? 0 : undefined
      });
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    checkAuthentication((isAuthenticated) => {
      sendResponse({ isAuthenticated });
    });
    return true;
  } else if (request.action === 'requestOTP') {
    fetch('https://sales-notification-backend.onrender.com/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse(data);
      })
      .catch(error => {
        console.error('Error requesting OTP:', error);
        sendResponse({ error: 'Failed to request OTP' });
      });
    return true;
  } else if (request.action === 'verifyOTP') {
    fetch('https://sales-notification-backend.onrender.com/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, otp: request.otp })
    })
      .then(response => response.json())
      .then(data => {
        if (data.message === 'OTP verified successfully') {
          setAuthentication(data.token, () => {
            sendResponse({ isAuthenticated: true });
            connectWebSocket();
          });
        } else {
          sendResponse({ error: data.error });
        }
      })
      .catch(error => {
        console.error('Error verifying OTP:', error);
        sendResponse({ error: 'Failed to verify OTP' });
      });
    return true;
  } else if (request.action === 'setPopupSize') {
    chrome.storage.local.set({ popupSize: request.size }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'getPopupSize') {
    chrome.storage.local.get(['popupSize'], (result) => {
      sendResponse({ size: result.popupSize || 'small' });
    });
    return true;
  }
});

chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Alarm triggered: Keeping service worker alive');
    checkAuthentication((isAuthenticated) => {
      if (isAuthenticated && (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
        console.log('WebSocket not connected. Reconnecting...');
        connectWebSocket();
      }
    });
  }
});

connectWebSocket();
