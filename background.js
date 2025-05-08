let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseReconnectDelay = 5000; // 5 seconds

function connectWebSocket() {
  console.log('Attempting to connect WebSocket...');
  ws = new WebSocket('wss://sales-notification-backend.onrender.com/ws');

  ws.onopen = () => {
    console.log('WebSocket connected successfully');
    reconnectAttempts = 0; // Reset attempts on successful connection
  };

  ws.onmessage = (event) => {
    console.log('WebSocket message received:', event.data);
    const saleData = JSON.parse(event.data);
    showPopup(saleData);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts); // Exponential backoff
      console.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${reconnectAttempts + 1})`);
      setTimeout(connectWebSocket, delay);
      reconnectAttempts++;
    } else {
      console.error('Max reconnect attempts reached. Please reload the extension.');
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    ws.close(); // Trigger onclose to handle reconnection
  };
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

// Keep service worker alive
setInterval(() => {
  console.log('Service worker ping: Keeping alive');
}, 30000); // Every 30 seconds

// Initialize WebSocket connection
connectWebSocket();
