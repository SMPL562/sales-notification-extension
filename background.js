let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseReconnectDelay = 5000;
const processedMessages = new Set(); // Track processed message IDs

function connectWebSocket() {
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
      // Deduplicate messages using messageId
      if (data.messageId && processedMessages.has(data.messageId)) {
        console.log('Duplicate message ignored:', data.messageId);
        return;
      }
      if (data.messageId) {
        processedMessages.add(data.messageId);
        // Clean up old message IDs to prevent memory growth
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
}

function sendPing() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
  setTimeout(sendPing, 30000);
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

chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Alarm triggered: Keeping service worker alive');
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      console.log('WebSocket not connected. Reconnecting...');
      connectWebSocket();
    }
  }
});

connectWebSocket();
