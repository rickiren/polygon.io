function connectWebSocket() {
  const ws = new WebSocket('wss://socket.polygon.io/crypto');

  let pingInterval;

  ws.on('open', () => {
    console.log('✅ WebSocket Connected');
    ws.send(JSON.stringify({ action: 'auth', params: API_KEY }));

    setTimeout(() => {
      ws.send(JSON.stringify({ action: 'subscribe', params: 'XT.*' }));
    }, 200);

    // ✅ Start sending keepalive pings
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        console.log('📡 Sent ping to keep alive');
      }
    }, 30000); // every 30 seconds
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      processMessage(parsed);
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('🔁 WebSocket Disconnected. Reconnecting in 5s...');
    clearInterval(pingInterval); // stop pinging
    setTimeout(connectWebSocket, 5000); // reconnect after delay
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket Error:', err);
    ws.close(); // force reconnect
  });
}