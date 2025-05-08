let ws = null;

function connectWebSocket() {
  ws = new WebSocket('wss://sales-notification-backend.onrender.com/ws');

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const saleData = JSON.parse(event.data);
    showPopup(saleData);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected. Reconnecting...');
    setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function showPopup(saleData) {
  const { bdeName, product, managerName } = saleData;
  const url = `popup.html?bdeName=${encodeURIComponent(bdeName)}&product=${encodeURIComponent(product)}&managerName=${encodeURIComponent(managerName)}`;

  chrome.windows.create({
    url: chrome.runtime.getURL(url),
    type: 'popup',
    width: 400,
    height: 300,
    focused: true
  });
}

// Initialize WebSocket connection
connectWebSocket();
