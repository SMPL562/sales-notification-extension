let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseReconnectDelay = 5000; // 5 seconds

function connectWebSocket() {
  console.log('Attempting to connect WebSocket...');
  ws = new WebSocket('wss://sales-notification-backend.onrender.com/ws');

  ws.onopen = () => {
    console.log('WebSocket connected successfully');
    reconnectAttempts = 0;
    // Start sending pings to keep connection alive
    sendPing();
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('WebSocket message received:', data);
    if (data.type === 'pong') {
      console.log('Received pong from server');
    } else {
      showPopup(data);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts) + Math.random() * 100; // Exponential backoff + jitter
      console.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${reconnectAttempts + 1})`);
      setTimeout(connectWebSocket, delay);
      reconnectAttempts++;
    } else {
      console.error('Max reconnect attempts reached. Please reload the extension.');
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    ws.close(); // Trigger onclose for reconnection
  };
}

function sendPing() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('Sending ping to server');
    ws.send(JSON.stringify({ type: 'ping' }));
  }
  // Schedule next ping
  setTimeout(sendPing, 30000); // Every 30 seconds
}

function showPopup(saleData) {
  const { bdeName, product, managerName } = saleData;
  console.log('Showing popup for sale:', saleData);
  const url = `popup.html?bdeName=${encodeURIComponent(bdeName)}&product=${encodeURIComponent(product)}&managerName=${encodeURIComponent(managerName)}`;

  chrome.windows.create({
    url: chrome.runtime.getURL(url),
    type: 'popup',
    width: 400,
    height: 300,
    focused: true
  });
}

// Create an alarm to keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 }); // Every 30 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Alarm triggered: Keeping service worker alive');
    // Check WebSocket state and reconnect if needed
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      console.log('WebSocket not connected. Reconnecting...');
      connectWebSocket();
    }
  }
});

// Initialize WebSocket connection
connectWebSocket();
